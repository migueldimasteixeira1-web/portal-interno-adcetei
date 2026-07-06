from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..admin_helpers import reject_null_fields
from ..audit import add_audit
from ..database import get_db
from ..models import RoleConfig, User
from ..permissions import ALL_PERMISSIONS, DEFAULT_ROLE_CONFIGS, PERMISSION_DEFINITIONS, normalize_permissions, require_permission
from ..schemas import PermissionDefinitionOut, RoleConfigOut, RoleConfigUpdate
from ..time_utils import utc_now

router = APIRouter()

@router.get("/roles", response_model=list[RoleConfigOut])
def list_roles(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("roles.manage")),
):
    return list(db.scalars(select(RoleConfig).where(RoleConfig.role.in_(DEFAULT_ROLE_CONFIGS.keys())).order_by(RoleConfig.role)))


@router.get("/permissions", response_model=list[PermissionDefinitionOut])
def list_permissions(actor: User = Depends(require_permission("roles.manage"))):
    return PERMISSION_DEFINITIONS


@router.patch("/roles/{role}", response_model=RoleConfigOut)
def update_role(
    role: str,
    payload: RoleConfigUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("roles.manage")),
):
    if role not in DEFAULT_ROLE_CONFIGS:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    config = db.get(RoleConfig, role)
    if not config:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    data = payload.model_dump(exclude_unset=True)
    reject_null_fields(data, {"description", "permissions"})
    if role == "admin" and "permissions" in data:
        data["permissions"] = sorted(ALL_PERMISSIONS)
    if "permissions" in data:
        invalid = sorted(set(data["permissions"]) - ALL_PERMISSIONS)
        if invalid:
            raise HTTPException(status_code=422, detail=f"Permissão inválida: {invalid[0]}")
        data["permissions"] = normalize_permissions(data["permissions"])
    changes: dict[str, Any] = {}
    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        old = getattr(config, field)
        if old != value:
            setattr(config, field, value)
            changes[field] = {"from": old, "to": value}
    if changes:
        config.updated_at = utc_now()
        add_audit(
            db,
            actor,
            "update",
            "role",
            role,
            f"{actor.full_name} atualizou o perfil {config.label}.",
            changes,
        )
        db.commit()
        db.refresh(config)
    return config


