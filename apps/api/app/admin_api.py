from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from .auth import generate_public_token, hash_password, hash_token, validate_institutional_email
from .catalog_forms import normalize_form_schema
from .database import get_db
from .email_service import send_verification_email
from .models import Asset, AuditLog, RoleConfig, ServiceCatalog, User
from .permissions import ALL_PERMISSIONS, PERMISSION_DEFINITIONS, normalize_permissions, require_permission
from .schemas import (
    AssetCreate,
    AssetOut,
    AssetUpdate,
    AuditLogOut,
    CatalogCreate,
    CatalogOut,
    CatalogUpdate,
    PermissionDefinitionOut,
    RoleConfigOut,
    RoleConfigUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
)
from .time_utils import utc_now
from .config import settings

router = APIRouter(prefix="/api/admin", tags=["administração"])


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


def catalog_payload(service: ServiceCatalog) -> dict[str, Any]:
    return {
        "id": service.id,
        "name": service.name,
        "category": service.category,
        "description": service.description,
        "icon": service.icon,
        "color": service.color,
        "active": service.active,
        "form_schema": normalize_form_schema(service.form_schema),
    }


def verification_url(token: str) -> str:
    return f"{settings.public_app_url.rstrip('/')}/confirmar-email?token={token}"


def set_email_verification_token(user: User) -> str:
    token = generate_public_token()
    user.email_verification_token_hash = hash_token(token)
    user.email_verification_expires_at = utc_now() + timedelta(minutes=settings.email_verification_expire_minutes)
    return token


def send_user_verification(user: User) -> None:
    token = set_email_verification_token(user)
    send_verification_email(user.email, user.full_name, verification_url(token))


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("users.manage")),
):
    username = payload.username.strip().lower()
    email = validate_institutional_email(str(payload.email))
    ensure_unique_user(db, username, email)
    user = User(
        username=username,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        secretariat=payload.secretariat.strip(),
        department=payload.department.strip(),
        phone=payload.phone.strip(),
        source="local",
        active=payload.active,
        email_verified_at=utc_now() if payload.email_verified else None,
    )
    db.add(user)
    db.flush()
    add_audit(
        db,
        actor,
        "create",
        "user",
        user.id,
        f"{actor.full_name} criou o usuário {user.full_name}.",
        {"username": user.username, "role": user.role, "active": user.active, "email_verified": bool(user.email_verified_at)},
    )
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("users.manage")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    data = payload.model_dump(exclude_unset=True)
    reject_null_fields(
        data,
        {"full_name", "email", "role", "secretariat", "department", "phone", "active", "email_verified"},
    )
    ensure_last_admin(db, user, data)
    if actor.id == user.id and data.get("active") is False:
        raise HTTPException(status_code=409, detail="Você não pode desativar sua própria conta")
    target_email = validate_institutional_email(str(data["email"])) if "email" in data else user.email
    ensure_unique_user(db, user.username, target_email, user.id)

    changes: dict[str, Any] = {}
    for field in ("full_name", "email", "role", "secretariat", "department", "phone", "active"):
        if field in data:
            value = data[field]
            if isinstance(value, str):
                value = value.strip()
            if field == "email":
                value = validate_institutional_email(str(value))
            old = getattr(user, field)
            if old != value:
                setattr(user, field, value)
                changes[field] = {"from": old, "to": value}
    if "email_verified" in data:
        old_verified = bool(user.email_verified_at)
        new_verified = bool(data["email_verified"])
        if old_verified != new_verified:
            user.email_verified_at = utc_now() if new_verified else None
            if new_verified:
                user.email_verification_token_hash = ""
                user.email_verification_expires_at = None
            changes["email_verified"] = {"from": old_verified, "to": new_verified}
    if data.get("password"):
        user.password_hash = hash_password(data["password"])
        changes["password"] = {"changed": True}

    if changes:
        add_audit(
            db,
            actor,
            "update",
            "user",
            user.id,
            f"{actor.full_name} atualizou o usuário {user.full_name}.",
            changes,
        )
        db.commit()
        db.refresh(user)
    return user


@router.post("/users/{user_id}/resend-verification", response_model=UserOut)
def resend_user_verification(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("users.manage")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.email_verified_at:
        raise HTTPException(status_code=409, detail="Este e-mail já está verificado")
    if not user.active:
        raise HTTPException(status_code=409, detail="Ative a conta antes de reenviar a verificação")
    try:
        send_user_verification(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Não foi possível enviar o e-mail de verificação. Tente novamente mais tarde.") from exc
    add_audit(
        db,
        actor,
        "resend_verification",
        "user",
        user.id,
        f"{actor.full_name} reenviou a verificação de e-mail para {user.full_name}.",
        {"email": user.email},
    )
    db.commit()
    db.refresh(user)
    return user


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


@router.post("/catalog", response_model=CatalogOut, status_code=201)
def create_catalog_service(
    payload: CatalogCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("catalog.manage")),
):
    name = payload.name.strip()
    if db.scalar(select(ServiceCatalog).where(func.lower(ServiceCatalog.name) == name.casefold())):
        raise HTTPException(status_code=409, detail="Já existe um serviço com este nome")
    service = ServiceCatalog(
        name=name,
        category=payload.category.strip(),
        description=payload.description.strip(),
        icon=payload.icon.strip(),
        color=payload.color,
        active=payload.active,
        form_schema=normalize_form_schema(payload.form_schema),
    )
    db.add(service)
    db.flush()
    add_audit(
        db,
        actor,
        "create",
        "catalog",
        service.id,
        f"{actor.full_name} criou o serviço {service.name}.",
        {"category": service.category, "active": service.active},
    )
    db.commit()
    return catalog_payload(service)


@router.patch("/catalog/{service_id}", response_model=CatalogOut)
def update_catalog_service(
    service_id: int,
    payload: CatalogUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("catalog.manage")),
):
    service = db.get(ServiceCatalog, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    data = payload.model_dump(exclude_unset=True)
    reject_null_fields(
        data,
        {"name", "category", "description", "icon", "color", "active", "form_schema"},
    )
    if "name" in data:
        duplicate = db.scalar(
            select(ServiceCatalog).where(
                func.lower(ServiceCatalog.name) == data["name"].strip().casefold(),
                ServiceCatalog.id != service.id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Já existe um serviço com este nome")
    if "form_schema" in data:
        data["form_schema"] = normalize_form_schema(data["form_schema"])
    changes: dict[str, Any] = {}
    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        old = getattr(service, field)
        if old != value:
            setattr(service, field, value)
            changes[field] = {"from": old, "to": value}
    if changes:
        add_audit(
            db,
            actor,
            "update",
            "catalog",
            service.id,
            f"{actor.full_name} atualizou o serviço {service.name}.",
            changes,
        )
        db.commit()
    return catalog_payload(service)


@router.get("/roles", response_model=list[RoleConfigOut])
def list_roles(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("roles.manage")),
):
    return list(db.scalars(select(RoleConfig).order_by(RoleConfig.role)))


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
