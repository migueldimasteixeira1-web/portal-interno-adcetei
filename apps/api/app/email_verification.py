from datetime import timedelta

from .auth import generate_public_token, hash_token
from .config import settings
from .email_service import send_verification_email
from .models import User
from .time_utils import utc_now


def verification_url(token: str) -> str:
    base = settings.public_app_url.rstrip("/")
    return f"{base}/confirmar-email?token={token}"


def set_email_verification_token(user: User) -> str:
    token = generate_public_token()
    user.email_verification_token_hash = hash_token(token)
    user.email_verification_expires_at = utc_now() + timedelta(minutes=settings.email_verification_expire_minutes)
    return token


def send_user_verification(user: User) -> None:
    token = set_email_verification_token(user)
    send_verification_email(user.email, user.full_name, verification_url(token))
