from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from ...admin_helpers import ensure_unique_asset, has_rows, reject_null_fields, validate_assigned_user
from ...audit import add_audit
from ...database import get_db
from ...delivery_terms_service import asset_has_delivery_term_history, ensure_asset_not_reserved
from ...return_terms_service import asset_has_return_term_history
from ...models import Asset, AssetMovement, Ticket, User
from ...permissions import require_permission
from ...schemas import AssetCreate, AssetOut, AssetUpdate

router = APIRouter()

@router.post("/assets", response_model=AssetOut, status_code=201)
def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("assets.manage")),
):
    data = payload.model_dump()
    validate_assigned_user(db, data["assigned_user_id"])
    ensure_unique_asset(db, data)
    asset = Asset(**{key: value.strip() if isinstance(value, str) else value for key, value in data.items()})
    db.add(asset)
    db.flush()
    add_audit(
        db,
        actor,
        "create",
        "asset",
        asset.id,
        f"{actor.full_name} cadastrou o equipamento {asset.name}.",
        {"status": asset.status, "patrimony": asset.patrimony},
    )
    db.commit()
    return db.scalar(select(Asset).where(Asset.id == asset.id).options(joinedload(Asset.assigned_user)))


@router.patch("/assets/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: int,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("assets.manage")),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    ensure_asset_not_reserved(db, asset.id)
    data = payload.model_dump(exclude_unset=True)
    reject_null_fields(
        data,
        {
            "name",
            "asset_type",
            "manufacturer",
            "model",
            "serial_number",
            "patrimony",
            "status",
            "location",
            "ip_address",
            "operating_system",
        },
    )
    validate_assigned_user(db, data.get("assigned_user_id") if "assigned_user_id" in data else asset.assigned_user_id)
    prospective = {
        "patrimony": data.get("patrimony", asset.patrimony),
        "serial_number": data.get("serial_number", asset.serial_number),
    }
    ensure_unique_asset(db, prospective, asset.id)
    changes: dict[str, Any] = {}
    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        old = getattr(asset, field)
        if old != value:
            setattr(asset, field, value)
            changes[field] = {"from": old, "to": value}
    if changes:
        add_audit(
            db,
            actor,
            "update",
            "asset",
            asset.id,
            f"{actor.full_name} atualizou o equipamento {asset.name}.",
            changes,
        )
        db.commit()
    return db.scalar(select(Asset).where(Asset.id == asset.id).options(joinedload(Asset.assigned_user)))


@router.delete("/assets/{asset_id}")
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("assets.manage")),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    ensure_asset_not_reserved(db, asset.id)
    if asset_has_delivery_term_history(db, asset.id):
        raise HTTPException(status_code=409, detail="Equipamento possui termo de recebimento vinculado. Use a baixa em vez de excluir.")
    if asset_has_return_term_history(db, asset.id):
        raise HTTPException(status_code=409, detail="Equipamento possui termo de devolução vinculado. Use a baixa em vez de excluir.")
    if has_rows(db, select(Ticket.id).where(Ticket.asset_id == asset.id)):
        raise HTTPException(status_code=409, detail="Equipamento possui chamados vinculados. Baixe ou arquive em vez de excluir.")

    deleted_name = asset.name
    db.execute(delete(AssetMovement).where(AssetMovement.asset_id == asset.id))
    db.delete(asset)
    add_audit(
        db,
        actor,
        "delete",
        "asset",
        asset_id,
        f"{actor.full_name} excluiu o equipamento {deleted_name}.",
        {"serial_number": asset.serial_number, "patrimony": asset.patrimony},
    )
    db.commit()
    return {"message": "Equipamento excluído com sucesso"}
