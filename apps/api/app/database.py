from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

database_url = settings.effective_database_url
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def ensure_schema_compatibility() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "users" not in table_names:
        return
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "email_verified_at" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP"))
            connection.execute(
                text(
                    """
                    UPDATE users
                    SET email_verified_at = COALESCE(created_at, CURRENT_TIMESTAMP)
                    WHERE lower(email) LIKE '%@%.cabofrio.rj.gov.br'
                      AND lower(email) NOT LIKE '%@cabofrio.rj.gov.br'
                    """
                )
            )
        if "email_verification_token_hash" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verification_token_hash VARCHAR(128) DEFAULT ''"))
        if "email_verification_expires_at" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP"))
        if "password_reset_token_hash" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(128) DEFAULT ''"))
        if "password_reset_expires_at" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP"))
        connection.execute(text("UPDATE users SET role = 'technician' WHERE role = 'helpdesk'"))
        connection.execute(text("UPDATE users SET role = 'user' WHERE role = 'requester'"))

    if "role_configs" in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE role_configs
                    SET role = 'technician', label = 'Técnico'
                    WHERE role = 'helpdesk'
                      AND NOT EXISTS (SELECT 1 FROM role_configs WHERE role = 'technician')
                    """
                )
            )
            connection.execute(text("DELETE FROM role_configs WHERE role IN ('helpdesk', 'requester')"))

    if "tickets" not in table_names:
        return
    ticket_columns = {column["name"] for column in inspector.get_columns("tickets")}
    with engine.begin() as connection:
        if "form_data" not in ticket_columns:
            connection.execute(text("ALTER TABLE tickets ADD COLUMN form_data JSON"))
        if "form_schema_snapshot" not in ticket_columns:
            connection.execute(text("ALTER TABLE tickets ADD COLUMN form_schema_snapshot JSON"))
        if "service_id" not in ticket_columns:
            connection.execute(text("ALTER TABLE tickets ADD COLUMN service_id INTEGER"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
