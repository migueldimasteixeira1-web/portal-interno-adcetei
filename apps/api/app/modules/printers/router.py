import asyncio
import hashlib
import json
from collections.abc import Callable
from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ...config import settings
from ...database import get_db
from ...models import AuditLog, User
from ...permissions import has_permission, require_permission
from .schemas import (
    PrinterActionIn,
    PrinterActionOut,
    PrinterDetailOut,
    PrinterDevicesOut,
    PrinterDriversOut,
    PrinterHealth,
    PrinterJobsOut,
    PrinterListOut,
)
from .service import PrinterService

router = APIRouter(prefix="/api/printers", tags=["impressoras"])


def get_printer_service() -> PrinterService:
    return PrinterService()


def add_printer_audit(
    db: Session,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: str,
    summary: str,
    changes: dict[str, Any],
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            changes=changes,
        )
    )


def audit_action(
    *,
    db: Session,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: str,
    payload: PrinterActionIn,
    operation: Callable[[], PrinterActionOut],
) -> PrinterActionOut:
    try:
        result = operation()
    except HTTPException as exc:
        add_printer_audit(
            db,
            actor,
            f"printer_{action}",
            entity_type,
            entity_id,
            f"{actor.full_name} tentou executar {action} em {entity_id}, mas a ação falhou.",
            {
                "reason": payload.reason.strip(),
                "target_printer": payload.target_printer.strip(),
                "result": "failure",
                "detail": exc.detail,
            },
        )
        db.commit()
        raise

    add_printer_audit(
        db,
        actor,
        f"printer_{action}",
        result.entity_type,
        result.entity_id,
        f"{actor.full_name} executou {action} em {result.entity_id}.",
        {
            "reason": payload.reason.strip(),
            "target_printer": payload.target_printer.strip(),
            "result": "success",
            "before": result.before,
            "after": result.after,
        },
    )
    db.commit()
    return result


def current_user_from_event_token(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sessão inválida") from exc
    user = db.get(User, user_id)
    if not user or not user.active:
        raise HTTPException(status_code=401, detail="Usuário indisponível")
    if not has_permission(db, user, "printers.events.view"):
        raise HTTPException(status_code=403, detail="Seu perfil não possui permissão para esta ação")
    return user


@router.get("/health", response_model=PrinterHealth)
def printer_health(
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.view")),
):
    return service.health()


@router.get("", response_model=PrinterListOut)
def list_printers(
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.view")),
):
    printers = service.list_printers()
    checked_at = printers[0].last_checked_at if printers else service.health().checked_at
    return PrinterListOut(printers=printers, checked_at=checked_at)


@router.get("/jobs", response_model=PrinterJobsOut)
def list_printer_jobs(
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.jobs.view")),
):
    jobs = service.list_jobs()
    checked_at = service.health().checked_at
    return PrinterJobsOut(jobs=jobs, checked_at=checked_at)


@router.get("/events")
async def printer_events(
    token: str = Query(default=""),
    db: Session = Depends(get_db),
    service: PrinterService = Depends(get_printer_service),
):
    current_user_from_event_token(token, db)

    async def event_stream():
        last_digest = ""
        while True:
            try:
                snapshot = service.snapshot()
                payload = snapshot.model_dump()
                raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
                digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
                if digest != last_digest:
                    last_digest = digest
                    yield f"event: printers.snapshot\ndata: {raw}\n\n"
                else:
                    yield "event: printers.heartbeat\ndata: {}\n\n"
            except Exception as exc:
                data = json.dumps({"message": "Não foi possível atualizar o estado do CUPS.", "detail": str(exc)}, ensure_ascii=False)
                yield f"event: printers.error\ndata: {data}\n\n"
            await asyncio.sleep(max(1, settings.cups_event_interval_seconds))

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/devices", response_model=PrinterDevicesOut)
def list_printer_devices(
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.admin.devices")),
):
    devices = service.list_devices()
    return PrinterDevicesOut(devices=devices, checked_at=service.health().checked_at)


@router.get("/drivers", response_model=PrinterDriversOut)
def list_printer_drivers(
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.admin.drivers")),
):
    drivers = service.list_drivers()
    return PrinterDriversOut(drivers=drivers, checked_at=service.health().checked_at)


@router.post("/jobs/{job_id}/cancel", response_model=PrinterActionOut)
def cancel_job(job_id: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.jobs.cancel"))):
    return audit_action(db=db, actor=actor, action="cancel_job", entity_type="printer_job", entity_id=job_id, payload=payload, operation=lambda: service.cancel_job(job_id, payload))


@router.post("/jobs/{job_id}/hold", response_model=PrinterActionOut)
def hold_job(job_id: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.jobs.hold"))):
    return audit_action(db=db, actor=actor, action="hold_job", entity_type="printer_job", entity_id=job_id, payload=payload, operation=lambda: service.hold_job(job_id, payload))


@router.post("/jobs/{job_id}/release", response_model=PrinterActionOut)
def release_job(job_id: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.jobs.release"))):
    return audit_action(db=db, actor=actor, action="release_job", entity_type="printer_job", entity_id=job_id, payload=payload, operation=lambda: service.release_job(job_id, payload))


@router.post("/jobs/{job_id}/restart", response_model=PrinterActionOut)
def restart_job(job_id: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.jobs.restart"))):
    return audit_action(db=db, actor=actor, action="restart_job", entity_type="printer_job", entity_id=job_id, payload=payload, operation=lambda: service.restart_job(job_id, payload))


@router.post("/jobs/{job_id}/move", response_model=PrinterActionOut)
def move_job(job_id: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.jobs.move"))):
    return audit_action(db=db, actor=actor, action="move_job", entity_type="printer_job", entity_id=job_id, payload=payload, operation=lambda: service.move_job(job_id, payload))


@router.get("/{printer_name}", response_model=PrinterDetailOut)
def get_printer(
    printer_name: str,
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.view")),
):
    return service.get_printer(printer_name)


@router.get("/{printer_name}/jobs", response_model=PrinterJobsOut)
def list_single_printer_jobs(
    printer_name: str,
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.jobs.view")),
):
    jobs = service.get_printer_jobs(printer_name)
    return PrinterJobsOut(jobs=jobs, checked_at=service.health().checked_at)


@router.post("/{printer_name}/enable", response_model=PrinterActionOut)
def enable_printer(printer_name: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.queue.enable"))):
    return audit_action(db=db, actor=actor, action="enable_printer", entity_type="printer", entity_id=printer_name, payload=payload, operation=lambda: service.enable_printer(printer_name, payload))


@router.post("/{printer_name}/disable", response_model=PrinterActionOut)
def disable_printer(printer_name: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.queue.disable"))):
    return audit_action(db=db, actor=actor, action="disable_printer", entity_type="printer", entity_id=printer_name, payload=payload, operation=lambda: service.disable_printer(printer_name, payload))


@router.post("/{printer_name}/accept", response_model=PrinterActionOut)
def accept_printer(printer_name: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.queue.accept"))):
    return audit_action(db=db, actor=actor, action="accept_printer", entity_type="printer", entity_id=printer_name, payload=payload, operation=lambda: service.accept_printer(printer_name, payload))


@router.post("/{printer_name}/reject", response_model=PrinterActionOut)
def reject_printer(printer_name: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.queue.reject"))):
    return audit_action(db=db, actor=actor, action="reject_printer", entity_type="printer", entity_id=printer_name, payload=payload, operation=lambda: service.reject_printer(printer_name, payload))


@router.post("/{printer_name}/purge", response_model=PrinterActionOut)
def purge_printer(printer_name: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.queue.purge"))):
    return audit_action(db=db, actor=actor, action="purge_printer", entity_type="printer", entity_id=printer_name, payload=payload, operation=lambda: service.purge_printer(printer_name, payload))


@router.post("/{printer_name}/set-default", response_model=PrinterActionOut)
def set_default_printer(printer_name: str, payload: PrinterActionIn, db: Session = Depends(get_db), service: PrinterService = Depends(get_printer_service), actor: User = Depends(require_permission("printers.queue.set_default"))):
    return audit_action(db=db, actor=actor, action="set_default_printer", entity_type="printer", entity_id=printer_name, payload=payload, operation=lambda: service.set_default_printer(printer_name, payload))


@router.post("", response_model=PrinterActionOut)
def create_printer(actor: User = Depends(require_permission("printers.admin.create"))):
    raise HTTPException(status_code=501, detail="Criação de impressoras será implementada na etapa administrativa do módulo.")


@router.patch("/{printer_name}", response_model=PrinterActionOut)
def update_printer(printer_name: str, actor: User = Depends(require_permission("printers.admin.update"))):
    raise HTTPException(status_code=501, detail="Edição de impressoras será implementada na etapa administrativa do módulo.")


@router.delete("/{printer_name}", response_model=PrinterActionOut)
def delete_printer(printer_name: str, actor: User = Depends(require_permission("printers.admin.delete"))):
    raise HTTPException(status_code=501, detail="Remoção de impressoras será implementada na etapa administrativa do módulo.")
