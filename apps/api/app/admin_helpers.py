from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .models import Asset, User

def reject_null_fields(data: dict[str, Any], fields: set[str]) -> None:
    invalid = sorted(field for field in fields if field in data and data[field] is None)
    if invalid:
        raise HTTPException(status_code=422, detail=f"O campo {invalid[0]} não pode ser nulo")


def ensure_unique_user(db: Session, username: str, email: str, exclude_id: int | None = None) -> None:
    query = select(User).where(
        or_(func.lower(User.username) == username.casefold(), func.lower(User.email) == email.casefold())
    )
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    existing = db.scalar(query)
    if existing:
        field = "usuário" if existing.username.casefold() == username.casefold() else "e-mail"
        raise HTTPException(status_code=409, detail=f"Já existe uma conta com este {field}")


def ensure_last_admin(db: Session, target: User, data: dict[str, Any]) -> None:
    removes_admin = target.role == "admin" and (
        data.get("active") is False or (data.get("role") is not None and data["role"] != "admin")
    )
    if not removes_admin:
        return
    active_admins = db.scalar(
        select(func.count(User.id)).where(User.role == "admin", User.active.is_(True))
    ) or 0
    if active_admins <= 1:
        raise HTTPException(status_code=409, detail="O sistema precisa manter pelo menos um administrador ativo")


def ensure_unique_asset(db: Session, data: dict[str, Any], exclude_id: int | None = None) -> None:
    checks = []
    if data.get("patrimony"):
        checks.append(func.lower(Asset.patrimony) == str(data["patrimony"]).casefold())
    if data.get("serial_number"):
        checks.append(func.lower(Asset.serial_number) == str(data["serial_number"]).casefold())
    if not checks:
        return
    query = select(Asset).where(or_(*checks))
    if exclude_id is not None:
        query = query.where(Asset.id != exclude_id)
    if db.scalar(query):
        raise HTTPException(status_code=409, detail="Patrimônio ou número de série já cadastrado")


def validate_assigned_user(db: Session, user_id: int | None) -> None:
    if user_id is None:
        return
    user = db.get(User, user_id)
    if not user or not user.active:
        raise HTTPException(status_code=400, detail="Usuário responsável inválido")


def has_rows(db: Session, query: Any) -> bool:
    return db.scalar(select(query.exists())) or False


