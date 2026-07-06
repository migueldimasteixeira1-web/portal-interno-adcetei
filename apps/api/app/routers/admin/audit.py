from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ...database import get_db
from ...models import AuditLog, User
from ...permissions import require_permission
from ...schemas import AuditLogOut

router = APIRouter()

@router.get("/audit", response_model=list[AuditLogOut])
def list_audit(
    entity_type: str | None = None,
    search: str | None = None,
    limit: int = Query(100, ge=1, le=300),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("audit.view")),
):
    query = select(AuditLog).options(joinedload(AuditLog.actor)).order_by(AuditLog.created_at.desc()).limit(limit)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if search:
        like = f"%{search}%"
        query = query.where(or_(AuditLog.summary.ilike(like), AuditLog.entity_id.ilike(like)))
    return list(db.scalars(query).unique())
