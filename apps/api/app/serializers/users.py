from typing import Any

from sqlalchemy.orm import Session

from ..models import User
from ..permissions import permissions_for_role


def serialize_user(
    user: User | None,
    db: Session | None = None,
    include_permissions: bool = False,
) -> dict[str, Any] | None:
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "secretariat": user.secretariat,
        "department": user.department,
        "registration": user.registration,
        "phone": user.phone,
        "source": user.source,
        "active": user.active,
        "email_verified_at": user.email_verified_at,
        "permissions": sorted(permissions_for_role(db, user.role)) if db and include_permissions else [],
        "last_login_at": user.last_login_at,
    }
