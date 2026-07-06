from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..domain import PRIORITY_LABELS, STATUS_LABELS, TECHNICIAN_STATUSES
from ..models import Asset, Ticket, User
from ..permissions import has_permission
from ..time_utils import utc_now

FIELD_LABELS = {
    "status": "o status",
    "priority": "a prioridade",
    "urgency": "a urgência",
    "impact": "o impacto",
    "category": "a categoria",
    "team": "a equipe",
    "location": "a localização",
    "assignee_id": "o responsável",
    "asset_id": "o equipamento",
}

FINAL_TICKET_STATUSES = {"closed", "cancelled"}
TECHNICIAN_UPDATE_FIELDS = {"status", "resolution_message"}
NON_NULLABLE_UPDATE_FIELDS = {"status", "priority", "urgency", "impact", "category", "team", "location"}


def now_utc() -> datetime:
    return utc_now()


def due_for_priority(priority: str) -> datetime:
    hours = {"critical": 2, "high": 4, "medium": 48, "low": 72}.get(priority, 48)
    return now_utc() + timedelta(hours=hours)


def display_value(field: str, value: Any, db: Session) -> str:
    if value in (None, ""):
        return "—"
    if field == "status":
        return STATUS_LABELS.get(str(value), str(value))
    if field in {"priority", "urgency", "impact"}:
        return PRIORITY_LABELS.get(str(value), str(value))
    if field == "assignee_id":
        user = db.get(User, value)
        return user.full_name if user else "—"
    if field == "asset_id":
        asset = db.get(Asset, value)
        return asset.name if asset else "—"
    return str(value)


def ensure_ticket_access(ticket: Ticket, current_user: User, db: Session) -> None:
    if has_permission(db, current_user, "tickets.view_all"):
        return
    if current_user.role == "user" and ticket.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso não permitido")
    if current_user.role != "user" and ticket.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso não permitido")


def validate_ticket_references(data: dict[str, Any], db: Session) -> None:
    if data.get("assignee_id") is not None:
        assignee = db.get(User, data["assignee_id"])
        if not assignee or not assignee.active or assignee.role not in {"admin", "technician"}:
            raise HTTPException(status_code=400, detail="Responsável inválido")
    if data.get("asset_id") is not None and not db.get(Asset, data["asset_id"]):
        raise HTTPException(status_code=400, detail="Equipamento inválido")


def change_message(actor: User, field: str, old: Any, new: Any, db: Session) -> str:
    old_label = display_value(field, old, db)
    new_label = display_value(field, new, db)
    if field == "assignee_id":
        if new is None:
            return f"{actor.full_name} removeu o responsável do chamado."
        if old is None:
            return f"{actor.full_name} atribuiu o chamado para {new_label}."
        return f"{actor.full_name} alterou o responsável de {old_label} para {new_label}."
    if field == "asset_id":
        if new is None:
            return f"{actor.full_name} removeu o equipamento vinculado ao chamado."
        if old is None:
            return f"{actor.full_name} vinculou o equipamento {new_label} ao chamado."
        return f"{actor.full_name} alterou o equipamento de {old_label} para {new_label}."
    label = FIELD_LABELS.get(field, f"o campo {field}")
    return f"{actor.full_name} alterou {label} de {old_label} para {new_label}."


def ticket_visibility_conditions(current_user: User, db: Session) -> list[Any]:
    if has_permission(db, current_user, "tickets.view_all"):
        return []
    if current_user.role == "user":
        return [Ticket.requester_id == current_user.id]
    return [Ticket.assignee_id == current_user.id]


def ticket_visibility(query, current_user: User, db: Session):
    return query.where(*ticket_visibility_conditions(current_user, db))


def ticket_filter_conditions(
    current_user: User,
    status_filter: str | None,
    priority: str | None,
    assignee_id: int | None,
    search: str | None,
    db: Session,
) -> list[Any]:
    conditions = ticket_visibility_conditions(current_user, db)
    if status_filter:
        statuses = [item.strip() for item in status_filter.split(",") if item.strip()]
        invalid_statuses = [item for item in statuses if item not in STATUS_LABELS]
        if invalid_statuses:
            raise HTTPException(status_code=422, detail="Status inválido")
        conditions.append(Ticket.status.in_(statuses))
    if priority:
        conditions.append(Ticket.priority == priority)
    if assignee_id:
        conditions.append(Ticket.assignee_id == assignee_id)
    if search:
        like = f"%{search}%"
        conditions.append(or_(Ticket.title.ilike(like), Ticket.description.ilike(like), Ticket.category.ilike(like)))
    return conditions
