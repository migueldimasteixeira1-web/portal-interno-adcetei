import argparse
import getpass
import os

from sqlalchemy import select

from .auth import hash_password
from .database import Base, SessionLocal, engine, ensure_schema_compatibility
from .models import User
from .time_utils import utc_now


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria o administrador local inicial.")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--full-name", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    password = os.environ.get("PORTAL_ADMIN_PASSWORD") or getpass.getpass("Senha do administrador: ")
    confirmation = os.environ.get("PORTAL_ADMIN_PASSWORD") or getpass.getpass("Confirme a senha: ")
    if password != confirmation:
        raise SystemExit("As senhas não conferem.")
    if len(password) < 10:
        raise SystemExit("Use uma senha com pelo menos 10 caracteres.")

    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.username == args.username))
        if existing:
            raise SystemExit(f'O usuário "{args.username}" já existe.')
        db.add(
            User(
                username=args.username,
                full_name=args.full_name,
                email=args.email,
                password_hash=hash_password(password),
                role="admin",
                department="ADCETEI",
                secretariat="Prefeitura de Cabo Frio",
                source="local",
                active=True,
                email_verified_at=utc_now(),
            )
        )
        db.commit()

    print(f'Administrador "{args.username}" criado com sucesso.')


if __name__ == "__main__":
    main()
