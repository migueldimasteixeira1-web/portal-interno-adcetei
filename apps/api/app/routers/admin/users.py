from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ..admin_helpers import ensure_last_admin, ensure_unique_user, has_rows, reject_null_fields
from ..audit import add_audit
from ..auth import hash_password, validate_institutional_email
from ..database import get_db
from ..email_verification import send_user_verification
from ..models import Asset, AssetMovement, AuditLog, Ticket, TicketComment, User
from ..permissions import require_permission
from ..schemas import UserCreate, UserOut, UserUpdate
from ..time_utils import utc_now

router = APIRouter()

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
        {"username", "full_name", "email", "role", "secretariat", "department", "phone", "active", "email_verified"},
    )
    ensure_last_admin(db, user, data)
    if actor.id == user.id and data.get("active") is False:
        raise HTTPException(status_code=409, detail="Você não pode desativar sua própria conta")
    target_username = data["username"].strip().lower() if "username" in data else user.username
    target_email = validate_institutional_email(str(data["email"])) if "email" in data else user.email
    ensure_unique_user(db, target_username, target_email, user.id)

    changes: dict[str, Any] = {}
    email_changed = False
    for field in ("username", "full_name", "email", "role", "secretariat", "department", "phone", "active"):
        if field in data:
            value = data[field]
            if isinstance(value, str):
                value = value.strip()
            if field == "username":
                value = str(value).lower()
            if field == "email":
                value = validate_institutional_email(str(value))
            old = getattr(user, field)
            if old != value:
                setattr(user, field, value)
                changes[field] = {"from": old, "to": value}
                if field == "email":
                    email_changed = True
    if email_changed:
        old_verified = bool(user.email_verified_at)
        user.email_verified_at = None
        user.email_verification_token_hash = ""
        user.email_verification_expires_at = None
        changes["email_verified"] = {
            "from": old_verified,
            "to": False,
            "reason": "email_changed",
        }
    if "email_verified" in data:
        old_verified = bool(user.email_verified_at)
        new_verified = bool(data["email_verified"])
        if email_changed and new_verified:
            new_verified = False
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


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("users.manage")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.id == actor.id:
        raise HTTPException(status_code=409, detail="Você não pode excluir sua própria conta")
    ensure_last_admin(db, user, {"active": False})
    if any(
        has_rows(db, query)
        for query in (
            select(Ticket.id).where(or_(Ticket.requester_id == user.id, Ticket.assignee_id == user.id)),
            select(TicketComment.id).where(TicketComment.author_id == user.id),
            select(Asset.id).where(Asset.assigned_user_id == user.id),
            select(AssetMovement.id).where(
                or_(
                    AssetMovement.from_user_id == user.id,
                    AssetMovement.to_user_id == user.id,
                    AssetMovement.actor_id == user.id,
                )
            ),
            select(AuditLog.id).where(AuditLog.actor_id == user.id),
        )
    ):
        raise HTTPException(status_code=409, detail="Usuário possui histórico vinculado. Bloqueie a conta em vez de excluir.")

    deleted_name = user.full_name
    db.delete(user)
    add_audit(
        db,
        actor,
        "delete",
        "user",
        user_id,
        f"{actor.full_name} excluiu o usuário {deleted_name}.",
        {"username": user.username, "email": user.email},
    )
    db.commit()
    return {"message": "Usuário excluído com sucesso"}


