from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Asset, InventoryDeliveryTerm, InventoryDeliveryTermItem
from .return_terms_service import open_return_term_for_asset, return_reservation_conflict_message


OPEN_DELIVERY_TERM_STATUSES = ("draft", "emitted")


def open_delivery_term_for_asset(db: Session, asset_id: int) -> InventoryDeliveryTerm | None:
    return db.scalar(
        select(InventoryDeliveryTerm)
        .join(InventoryDeliveryTermItem, InventoryDeliveryTermItem.term_id == InventoryDeliveryTerm.id)
        .where(
            InventoryDeliveryTermItem.asset_id == asset_id,
            InventoryDeliveryTerm.status.in_(OPEN_DELIVERY_TERM_STATUSES),
        )
        .order_by(InventoryDeliveryTerm.id)
    )


def asset_has_delivery_term_history(db: Session, asset_id: int) -> bool:
    return bool(
        db.scalar(
            select(InventoryDeliveryTermItem.id)
            .where(InventoryDeliveryTermItem.asset_id == asset_id)
            .limit(1)
        )
    )


def reservation_conflict_message(term: InventoryDeliveryTerm) -> str:
    return f"Equipamento vinculado ao termo aberto {term.term_number}. Cancele ou confirme o termo antes de movimentá-lo."


def ensure_asset_not_reserved(db: Session, asset_id: int) -> None:
    if db.bind and db.bind.dialect.name == "postgresql":
        db.scalar(select(Asset.id).where(Asset.id == asset_id).with_for_update())
    term = open_delivery_term_for_asset(db, asset_id)
    if term:
        raise HTTPException(status_code=409, detail=reservation_conflict_message(term))
    return_term = open_return_term_for_asset(db, asset_id)
    if return_term:
        raise HTTPException(status_code=409, detail=return_reservation_conflict_message(return_term))
