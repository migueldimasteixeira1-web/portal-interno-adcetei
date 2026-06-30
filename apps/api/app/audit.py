from typing import Any

from sqlalchemy.orm import Session

from .models import AuditLog, User


def add_audit(
    db: Session,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: str | int,
    summary: str,
    changes: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            summary=summary,
            changes=changes or {},
        )
    )
