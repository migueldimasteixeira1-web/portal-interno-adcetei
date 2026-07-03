from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings
from .inventory_constants import DEFAULT_INVENTORY_SECTOR
from .inventory_service import normalize_catalog_name

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
        if "role" in user_columns:
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

    if "inventory_sectors" in table_names:
        normalized_default_sector = normalize_catalog_name(DEFAULT_INVENTORY_SECTOR)
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO inventory_sectors (name, normalized_name, is_active, created_at, updated_at)
                    SELECT CAST(:name AS VARCHAR), CAST(:normalized_name AS VARCHAR), TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    WHERE NOT EXISTS (
                        SELECT 1 FROM inventory_sectors WHERE normalized_name = CAST(:normalized_name AS VARCHAR)
                    )
                    """
                ),
                {"name": DEFAULT_INVENTORY_SECTOR, "normalized_name": normalized_default_sector},
            )

    if "assets" in table_names:
        asset_columns = {column["name"] for column in inspector.get_columns("assets")}
        with engine.begin() as connection:
            if "supplier_id" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN supplier_id INTEGER"))
            if "equipment_type_id" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN equipment_type_id INTEGER"))
            if "manufacturer_id" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN manufacturer_id INTEGER"))
            if "equipment_model_id" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN equipment_model_id INTEGER"))
            if "sector_id" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN sector_id INTEGER"))
            if "received_at" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN received_at TIMESTAMP"))
            if "delivered_at" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN delivered_at TIMESTAMP"))
            if "notes" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN notes TEXT DEFAULT ''"))
            if "asset_movements" not in table_names:
                movement_id_column = (
                    "id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"
                    if engine.dialect.name == "postgresql"
                    else "id INTEGER PRIMARY KEY"
                )
                connection.execute(
                    text(
                        f"""
                        CREATE TABLE asset_movements (
                            {movement_id_column},
                            asset_id INTEGER NOT NULL,
                            action VARCHAR(60) NOT NULL,
                            from_sector_id INTEGER,
                            to_sector_id INTEGER,
                            from_user_id INTEGER,
                            to_user_id INTEGER,
                            from_status VARCHAR(40),
                            to_status VARCHAR(40) NOT NULL,
                            movement_date TIMESTAMP NOT NULL,
                            notes TEXT DEFAULT '',
                            actor_id INTEGER,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(asset_id) REFERENCES assets(id),
                            FOREIGN KEY(from_sector_id) REFERENCES inventory_sectors(id),
                            FOREIGN KEY(to_sector_id) REFERENCES inventory_sectors(id),
                            FOREIGN KEY(from_user_id) REFERENCES users(id),
                            FOREIGN KEY(to_user_id) REFERENCES users(id),
                            FOREIGN KEY(actor_id) REFERENCES users(id)
                        )
                        """
                    )
                )
                connection.execute(text("CREATE INDEX ix_asset_movements_asset_id ON asset_movements (asset_id)"))
                connection.execute(text("CREATE INDEX ix_asset_movements_action ON asset_movements (action)"))
                connection.execute(text("CREATE INDEX ix_asset_movements_actor_id ON asset_movements (actor_id)"))
                connection.execute(text("CREATE INDEX ix_asset_movements_created_at ON asset_movements (created_at)"))
                connection.execute(text("CREATE INDEX ix_asset_movements_movement_date ON asset_movements (movement_date)"))

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
