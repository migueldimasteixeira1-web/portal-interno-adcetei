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
    if "tickets" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("tickets")}
    with engine.begin() as connection:
        if "form_data" not in columns:
            connection.execute(text("ALTER TABLE tickets ADD COLUMN form_data JSON"))
        if "form_schema_snapshot" not in columns:
            connection.execute(text("ALTER TABLE tickets ADD COLUMN form_schema_snapshot JSON"))
        if "service_id" not in columns:
            connection.execute(text("ALTER TABLE tickets ADD COLUMN service_id INTEGER"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
