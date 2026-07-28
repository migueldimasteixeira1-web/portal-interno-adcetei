from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload

from ..audit import add_audit
from ..config import settings
from ..database import get_db
from ..integrations.meshcentral_client import MeshBridgeClient, MeshBridgeError, MeshDevice
from ..inventory_service import build_asset_display_name
from ..models import Asset, RemoteAccessSession, RemoteDeviceLink, Ticket, User
from ..permissions import has_permission, require_permission
from ..schemas import (
    RemoteAccessAssetRefOut,
    RemoteAccessDeviceOut,
    RemoteAccessDevicePageOut,
    RemoteAccessHealthOut,
    RemoteAccessLaunchOut,
    RemoteAccessSessionCreate,
    RemoteAccessSessionOut,
    RemoteAccessSummaryOut,
)
from ..time_utils import utc_now

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/remote-access", tags=["acesso remoto"])


def _bridge() -> MeshBridgeClient:
    return MeshBridgeClient()


def _feature_enabled() -> None:
    if not settings.remote_access_enabled:
        raise HTTPException(status_code=503, detail="Módulo de acesso remoto não está habilitado neste ambiente.")


def _asset_ref(asset: Asset | None) -> RemoteAccessAssetRefOut | None:
    if not asset:
        return None
    return RemoteAccessAssetRefOut(
        id=asset.id,
        display_name=build_asset_display_name(
            asset.equipment_type.name if asset.equipment_type else asset.asset_type,
            asset.manufacturer_ref.name if asset.manufacturer_ref else asset.manufacturer,
            asset.equipment_model.name if asset.equipment_model else asset.model,
            asset.serial_number,
        ),
        serial_number=asset.serial_number or "",
    )


def _device_out(device: MeshDevice, links: dict[str, RemoteDeviceLink]) -> RemoteAccessDeviceOut:
    link = links.get(device.node_id)
    return RemoteAccessDeviceOut(
        node_id=device.node_id,
        name=device.name,
        group_id=device.group_id,
        group_name=device.group_name,
        online=device.online,
        operating_system=device.operating_system,
        ip_address=device.ip_address,
        last_seen_at=device.last_seen_at,
        agent_version=device.agent_version,
        asset=_asset_ref(link.asset if link else None),
    )


def _session_out(session: RemoteAccessSession) -> RemoteAccessSessionOut:
    return RemoteAccessSessionOut(
        id=session.id,
        portal_user_id=session.portal_user_id,
        mesh_user_id=session.mesh_user_id,
        mesh_node_id=session.mesh_node_id,
        mesh_group_id=session.mesh_group_id,
        asset_id=session.asset_id,
        ticket_id=session.ticket_id,
        device_name_snapshot=session.device_name_snapshot,
        reason=session.reason,
        access_mode=session.access_mode,
        status=session.status,
        requested_at=session.requested_at,
        authorized_at=session.authorized_at,
        opened_at=session.opened_at,
        ended_at=session.ended_at,
        source_ip=session.source_ip,
        failure_reason=session.failure_reason,
        portal_user=session.portal_user,
        asset=_asset_ref(session.asset),
    )


def _remote_user_id(user: User) -> str:
    # Identificador estável para auditoria no MeshCentral. A sincronização real fica no mesh-bridge.
    return f"portal_{user.username}".lower().replace(" ", ".")


def _ensure_session_access(db: Session, session: RemoteAccessSession, current_user: User) -> None:
    """Restringe leitura/operação de uma sessão a quem a abriu ou a quem gerencia o módulo.

    Sem essa checagem, qualquer usuário com `remote_access.view`/`.connect` podia consultar,
    reabrir ou encerrar a sessão de acesso remoto de outra pessoa (IDOR), incluindo o motivo
    informado e o IP de origem.
    """
    if session.portal_user_id == current_user.id:
        return
    if has_permission(db, current_user, "remote_access.manage"):
        return
    raise HTTPException(status_code=403, detail="Você não tem acesso a esta sessão de acesso remoto.")


def _bridge_error_detail(exc: MeshBridgeError, *, context: str) -> str:
    # O mesh-bridge/meshctrl pode incluir caminhos, argumentos ou detalhes internos na mensagem
    # de erro. Isso fica só no log do servidor; o usuário recebe uma mensagem genérica.
    logger.warning("Falha no Mesh Bridge (%s): %s", context, exc)
    return "Não foi possível se comunicar com o Mesh Bridge. Tente novamente em instantes."


@router.get("/health", response_model=RemoteAccessHealthOut)
def remote_access_health(
    current_user: User = Depends(require_permission("remote_access.view")),
):
    if not settings.remote_access_enabled:
        return RemoteAccessHealthOut(enabled=False, bridge_online=False, message="Módulo desabilitado por configuração.")
    try:
        _bridge().health()
    except MeshBridgeError as exc:
        return RemoteAccessHealthOut(enabled=True, bridge_online=False, message=str(exc))
    return RemoteAccessHealthOut(enabled=True, bridge_online=True, message="Mesh Bridge disponível.")


@router.get("/devices", response_model=RemoteAccessDevicePageOut)
def list_remote_devices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = "",
    status: str = Query("", pattern="^(|online|offline)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("remote_access.view")),
):
    _feature_enabled()
    try:
        result = _bridge().list_devices(page=page, page_size=page_size, search=search.strip(), status=status)
    except MeshBridgeError as exc:
        raise HTTPException(status_code=502, detail=_bridge_error_detail(exc, context="list_devices")) from exc

    node_ids = [item.node_id for item in result["items"]]
    links = {}
    if node_ids:
        rows = db.scalars(
            select(RemoteDeviceLink)
            .options(joinedload(RemoteDeviceLink.asset).joinedload(Asset.equipment_type))
            .options(joinedload(RemoteDeviceLink.asset).joinedload(Asset.manufacturer_ref))
            .options(joinedload(RemoteDeviceLink.asset).joinedload(Asset.equipment_model))
            .where(RemoteDeviceLink.mesh_node_id.in_(node_ids))
        )
        links = {link.mesh_node_id: link for link in rows}

    summary_payload = result.get("summary") or {}
    filtered_total = int(result["total"])
    summary_total = int(summary_payload["total"]) if "total" in summary_payload else filtered_total
    if "online" in summary_payload:
        online = int(summary_payload["online"])
    else:
        # Sem "summary" do bridge só enxergamos a página atual, então este número reflete
        # apenas os itens retornados, não o total real de dispositivos online.
        online = sum(1 for item in result["items"] if item.online)
    if "offline" in summary_payload:
        offline = int(summary_payload["offline"])
    else:
        offline = max(0, summary_total - online)
    return RemoteAccessDevicePageOut(
        items=[_device_out(item, links) for item in result["items"]],
        total=filtered_total,
        page=int(result["page"]),
        page_size=int(result["page_size"]),
        summary=RemoteAccessSummaryOut(total=summary_total, online=online, offline=offline),
        enabled=settings.remote_access_enabled,
    )


def _resolve_remote_device(node_id: str) -> MeshDevice:
    try:
        device = _bridge().get_device(node_id)
    except MeshBridgeError as exc:
        raise HTTPException(status_code=502, detail=_bridge_error_detail(exc, context="get_device")) from exc
    if not device.online:
        raise HTTPException(status_code=409, detail="Este computador está offline no MeshCentral.")
    return device


def _create_remote_session_record(
    *,
    payload: RemoteAccessSessionCreate,
    device: MeshDevice,
    request: Request,
    db: Session,
    current_user: User,
) -> RemoteAccessSession:
    asset = db.get(Asset, payload.asset_id) if payload.asset_id else None
    if payload.asset_id and not asset:
        raise HTTPException(status_code=404, detail="Equipamento do inventário não encontrado.")
    if payload.ticket_id and not db.get(Ticket, payload.ticket_id):
        raise HTTPException(status_code=404, detail="Chamado relacionado não encontrado.")

    now = utc_now()
    session = RemoteAccessSession(
        id=str(uuid4()),
        portal_user_id=current_user.id,
        mesh_user_id=_remote_user_id(current_user),
        mesh_node_id=device.node_id,
        mesh_group_id=device.group_id,
        asset_id=asset.id if asset else None,
        ticket_id=payload.ticket_id,
        device_name_snapshot=device.name,
        reason=payload.reason,
        access_mode=payload.access_mode,
        status="authorized",
        requested_at=now,
        authorized_at=now,
        source_ip=request.client.host if request.client else "",
    )
    db.add(session)
    db.flush()
    add_audit(
        db,
        actor=current_user,
        action="authorize_remote_access",
        entity_type="remote_access_session",
        entity_id=session.id,
        summary=f"{current_user.full_name} solicitou acesso remoto a {device.name}.",
        changes={
            "node_id": device.node_id,
            "device": device.name,
            "reason": payload.reason,
            "ticket_id": payload.ticket_id,
            "asset_id": payload.asset_id,
        },
    )
    return session


def _launch_remote_session_record(
    *,
    session: RemoteAccessSession,
    db: Session,
    current_user: User,
) -> dict:
    try:
        launch = _bridge().create_session_url(
            session_id=session.id,
            node_id=session.mesh_node_id,
            user_id=str(current_user.id),
            user_name=current_user.full_name,
            user_email=current_user.email,
            reason=session.reason,
            access_mode=session.access_mode,
        )
    except MeshBridgeError as exc:
        session.status = "failed"
        session.failure_reason = str(exc)
        db.commit()
        raise HTTPException(status_code=502, detail=_bridge_error_detail(exc, context="create_session_url")) from exc

    session.status = "open"
    session.opened_at = session.opened_at or utc_now()
    if launch.get("mesh_user_id"):
        session.mesh_user_id = launch["mesh_user_id"]
    add_audit(
        db,
        actor=current_user,
        action="open_remote_access",
        entity_type="remote_access_session",
        entity_id=session.id,
        summary=f"{current_user.full_name} abriu sessão remota em {session.device_name_snapshot}.",
        changes={"node_id": session.mesh_node_id, "access_mode": session.access_mode},
    )
    db.commit()
    db.refresh(session)
    return launch


@router.post("/sessions", response_model=RemoteAccessSessionOut, status_code=201)
def create_remote_access_session(
    payload: RemoteAccessSessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("remote_access.connect")),
):
    _feature_enabled()
    device = _resolve_remote_device(payload.node_id)
    session = _create_remote_session_record(
        payload=payload,
        device=device,
        request=request,
        db=db,
        current_user=current_user,
    )
    db.commit()
    session = db.scalar(
        select(RemoteAccessSession)
        .options(joinedload(RemoteAccessSession.portal_user), joinedload(RemoteAccessSession.asset))
        .where(RemoteAccessSession.id == session.id)
    )
    return _session_out(session)


@router.post("/sessions/connect", response_model=RemoteAccessLaunchOut, status_code=201)
def connect_remote_access_session(
    payload: RemoteAccessSessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("remote_access.connect")),
):
    _feature_enabled()
    device = _resolve_remote_device(payload.node_id)
    session = _create_remote_session_record(
        payload=payload,
        device=device,
        request=request,
        db=db,
        current_user=current_user,
    )
    launch = _launch_remote_session_record(session=session, db=db, current_user=current_user)
    session = db.scalar(
        select(RemoteAccessSession)
        .options(joinedload(RemoteAccessSession.portal_user), joinedload(RemoteAccessSession.asset))
        .where(RemoteAccessSession.id == session.id)
    )
    return RemoteAccessLaunchOut(
        session=_session_out(session),
        embed_url=launch["embed_url"],
        expires_in_seconds=launch["expires_in_seconds"],
    )


@router.get("/sessions/{session_id}", response_model=RemoteAccessSessionOut)
def get_remote_access_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("remote_access.view")),
):
    session = db.scalar(
        select(RemoteAccessSession)
        .options(joinedload(RemoteAccessSession.portal_user), joinedload(RemoteAccessSession.asset))
        .where(RemoteAccessSession.id == session_id)
    )
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de acesso remoto não encontrada.")
    _ensure_session_access(db, session, current_user)
    return _session_out(session)


@router.post("/sessions/{session_id}/launch", response_model=RemoteAccessLaunchOut)
def launch_remote_access_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("remote_access.connect")),
):
    _feature_enabled()
    session = db.scalar(
        select(RemoteAccessSession)
        .options(joinedload(RemoteAccessSession.portal_user), joinedload(RemoteAccessSession.asset))
        .where(RemoteAccessSession.id == session_id)
    )
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de acesso remoto não encontrada.")
    _ensure_session_access(db, session, current_user)
    if session.status == "ended":
        raise HTTPException(status_code=409, detail="Esta sessão já foi encerrada.")
    _resolve_remote_device(session.mesh_node_id)
    launch = _launch_remote_session_record(session=session, db=db, current_user=current_user)
    session = db.scalar(
        select(RemoteAccessSession)
        .options(joinedload(RemoteAccessSession.portal_user), joinedload(RemoteAccessSession.asset))
        .where(RemoteAccessSession.id == session.id)
    )
    return RemoteAccessLaunchOut(
        session=_session_out(session),
        embed_url=launch["embed_url"],
        expires_in_seconds=launch["expires_in_seconds"],
    )


@router.post("/sessions/{session_id}/close", response_model=RemoteAccessSessionOut)
def close_remote_access_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("remote_access.connect")),
):
    session = db.scalar(
        select(RemoteAccessSession)
        .options(joinedload(RemoteAccessSession.portal_user), joinedload(RemoteAccessSession.asset))
        .where(RemoteAccessSession.id == session_id)
    )
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de acesso remoto não encontrada.")
    _ensure_session_access(db, session, current_user)

    # UPDATE condicional atômico: se duas requisições de encerramento chegarem concorrentemente
    # para a mesma sessão, apenas uma altera uma linha e apenas essa grava auditoria.
    result = db.execute(
        update(RemoteAccessSession)
        .where(RemoteAccessSession.id == session.id, RemoteAccessSession.status != "ended")
        .values(status="ended", ended_at=utc_now())
    )
    if result.rowcount:
        add_audit(
            db,
            actor=current_user,
            action="close_remote_access",
            entity_type="remote_access_session",
            entity_id=session.id,
            summary=f"{current_user.full_name} encerrou a sessão remota em {session.device_name_snapshot}.",
            changes={"node_id": session.mesh_node_id},
        )
        db.commit()
        db.refresh(session)
    return _session_out(session)
