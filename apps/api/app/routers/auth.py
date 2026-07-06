from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import (
    create_access_token,
    get_current_user,
    hash_password,
    hash_token,
    normalize_email,
    validate_institutional_email,
    verify_password,
)
from ..database import get_db
from ..email_verification import send_user_verification
from ..models import User
from ..schemas import LoginIn, LoginOut, MessageOut, RegisterIn, ResendVerificationIn, UserOut, VerifyEmailIn
from ..serializers.users import serialize_user
from ..services.tickets_service import now_utc
from ..time_utils import ensure_utc
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/api/auth", tags=["autenticação"])


def generate_username_from_email(db: Session, email: str) -> str:
    base = email.split("@", 1)[0].replace("+", ".")[:100]
    username = base
    suffix = 2
    while db.scalar(select(User.id).where(func.lower(User.username) == username.casefold())):
        username = f"{base[:110]}{suffix}"
        suffix += 1
    return username


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    identifier = validate_institutional_email(payload.username)
    user = db.scalar(select(User).where(func.lower(User.email) == identifier))

    if user and not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha inválidos")

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha inválidos")

    try:
        validate_institutional_email(user.email)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta conta precisa usar um e-mail institucional válido para entrar.",
        ) from None

    if not user.email_verified_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirme seu e-mail institucional antes de entrar no portal.",
        )

    user.last_login_at = now_utc()
    db.commit()
    db.refresh(user)
    return LoginOut(
        access_token=create_access_token(user),
        user=serialize_user(user, db, include_permissions=True),
    )


@router.post("/register", response_model=MessageOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = validate_institutional_email(str(payload.email))
    existing = db.scalar(select(User).where(func.lower(User.email) == email.casefold()))
    if existing:
        if existing.active and not existing.email_verified_at:
            try:
                send_user_verification(existing)
            except Exception as exc:
                db.rollback()
                raise HTTPException(status_code=503, detail="Não foi possível enviar o e-mail de verificação. Tente novamente mais tarde.") from exc
            db.commit()
        return {"message": "Se o cadastro puder ser concluído, enviaremos um link de verificação para seu e-mail institucional."}

    user = User(
        username=generate_username_from_email(db, email),
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="user",
        secretariat="Prefeitura de Cabo Frio",
        department="Não informado",
        source="email",
        active=True,
        email_verified_at=None,
    )
    db.add(user)
    db.flush()
    try:
        send_user_verification(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Não foi possível enviar o e-mail de verificação. Tente novamente mais tarde.") from exc
    db.commit()
    return {"message": "Se o cadastro puder ser concluído, enviaremos um link de verificação para seu e-mail institucional."}


@router.post("/verify-email", response_model=MessageOut)
def verify_email(payload: VerifyEmailIn, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token)
    user = db.scalar(select(User).where(User.email_verification_token_hash == token_hash))
    expires_at = ensure_utc(user.email_verification_expires_at) if user else None
    if not user or not expires_at or expires_at < now_utc():
        raise HTTPException(status_code=400, detail="Link de verificação inválido ou expirado.")

    user.email_verified_at = now_utc()
    user.email_verification_token_hash = ""
    user.email_verification_expires_at = None
    db.commit()
    return {"message": "E-mail confirmado com sucesso. Você já pode entrar no portal."}


@router.post("/resend-verification", response_model=MessageOut)
def resend_verification(payload: ResendVerificationIn, db: Session = Depends(get_db)):
    email = normalize_email(str(payload.email))
    generic = {"message": "Se houver uma conta pendente para este e-mail, enviaremos um novo link de verificação."}
    user = db.scalar(select(User).where(func.lower(User.email) == email.casefold()))
    if not user or user.email_verified_at or not user.active:
        return generic
    try:
        send_user_verification(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Não foi possível enviar o e-mail de verificação. Tente novamente mais tarde.") from exc
    db.commit()
    return generic


@router.get("/me", response_model=UserOut)
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return serialize_user(current_user, db, include_permissions=True)
