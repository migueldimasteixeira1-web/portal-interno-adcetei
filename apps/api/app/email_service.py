from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from .config import settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def send_email(to_email: str, subject: str, body: str) -> None:
    if not smtp_configured():
        if settings.is_local_environment:
            logger.warning("SMTP não configurado. E-mail para %s:\n%s", to_email, body)
            return
        raise RuntimeError("SMTP não configurado para envio de e-mail.")

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


def send_verification_email(to_email: str, full_name: str, verification_url: str) -> None:
    body = (
        f"Olá, {full_name}.\n\n"
        "Recebemos seu cadastro no Portal Interno ADCETEI da Prefeitura de Cabo Frio.\n"
        "Para ativar sua conta, confirme seu e-mail institucional pelo link abaixo:\n\n"
        f"{verification_url}\n\n"
        "Este link expira em breve. Se você não solicitou este cadastro, ignore esta mensagem.\n\n"
        "ADCETEI - Tecnologia da Informação"
    )
    send_email(to_email, "Confirme seu e-mail institucional - Portal ADCETEI", body)
