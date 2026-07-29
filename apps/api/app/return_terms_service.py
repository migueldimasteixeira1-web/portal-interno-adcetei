from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Asset, InventoryReturnTerm, InventoryReturnTermItem


OPEN_RETURN_TERM_STATUSES = ("draft", "emitted")


def open_return_term_for_asset(db: Session, asset_id: int) -> InventoryReturnTerm | None:
    return db.scalar(
        select(InventoryReturnTerm)
        .join(InventoryReturnTermItem, InventoryReturnTermItem.term_id == InventoryReturnTerm.id)
        .where(
            InventoryReturnTermItem.asset_id == asset_id,
            InventoryReturnTerm.status.in_(OPEN_RETURN_TERM_STATUSES),
        )
        .order_by(InventoryReturnTerm.id)
    )


def asset_has_return_term_history(db: Session, asset_id: int) -> bool:
    return bool(
        db.scalar(
            select(InventoryReturnTermItem.id)
            .where(InventoryReturnTermItem.asset_id == asset_id)
            .limit(1)
        )
    )


def return_reservation_conflict_message(term: InventoryReturnTerm) -> str:
    return f"Equipamento vinculado ao termo de devolução aberto {term.term_number}. Cancele ou confirme o termo antes de movimentá-lo."


def ensure_asset_not_reserved_for_return(db: Session, asset_id: int) -> None:
    if db.bind and db.bind.dialect.name == "postgresql":
        db.scalar(select(Asset.id).where(Asset.id == asset_id).with_for_update())
    term = open_return_term_for_asset(db, asset_id)
    if term:
        raise HTTPException(status_code=409, detail=return_reservation_conflict_message(term))
