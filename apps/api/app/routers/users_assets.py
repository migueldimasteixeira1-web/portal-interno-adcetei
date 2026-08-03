from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..catalog_forms import catalog_payload
from ..database import get_db
from ..models import ServiceCatalog, User
from ..permissions import has_permission, require_permission
from ..schemas import CatalogOut, UserOut
from ..serializers.users import serialize_user

router = APIRouter(prefix="/api", tags=["listagens"])


@router.get("/users", response_model=list[UserOut])
def list_users(
    role: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
):
    query = select(User).order_by(User.full_name)
    if role:
        query = query.where(User.role == role)
    if search:
        like = f"%{search}%"
        query = query.where(or_(User.full_name.ilike(like), User.username.ilike(like), User.email.ilike(like), User.registration.ilike(like)))
    users = list(db.scalars(query))
    return [serialize_user(user, db, include_permissions=True) for user in users]


@router.get("/catalog", response_model=list[CatalogOut])
def list_catalog(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if include_inactive and not has_permission(db, current_user, "catalog.manage"):
        raise HTTPException(status_code=403, detail="Acesso não permitido")
    query = select(ServiceCatalog).order_by(ServiceCatalog.category, ServiceCatalog.name)
    if not include_inactive:
        query = query.where(ServiceCatalog.active.is_(True))
    services = list(db.scalars(query))
    return [catalog_payload(service) for service in services]
