from datetime import datetime, timedelta, timezone
import hashlib
import re
import secrets

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)
INSTITUTIONAL_EMAIL_MESSAGE = (
    "Use seu e-mail institucional no formato nome@secretaria.cabofrio.rj.gov.br. "
    "E-mails @cabofrio.rj.gov.br ainda não estão no padrão exigido."
)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    if not encoded:
        return False
    try:
        return password_hash.verify(password, encoded)
    except Exception:
        return False


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_institutional_email(email: str) -> str:
    normalized = normalize_email(email)
    if not re.fullmatch(settings.institutional_email_pattern, normalized):
        raise HTTPException(status_code=422, detail=INSTITUTIONAL_EMAIL_MESSAGE)
    return normalized


def generate_public_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida") from exc

    user = db.get(User, user_id)
    if not user or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário indisponível")
    try:
        validate_institutional_email(user.email)
    except HTTPException as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta conta precisa usar um e-mail institucional válido para entrar.",
        ) from exc
    if not user.email_verified_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirme seu e-mail institucional antes de entrar no portal.",
        )
    return user


def require_roles(*roles: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido")
        return current_user

    return checker
