#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
API_PYTHON="$API_DIR/.venv/bin/python"
BASELINE_REVISION="20260717_0001"
TEST_ROOT="$(mktemp -d)"
EMPTY_DB="$TEST_ROOT/empty.db"
EXISTING_DB="$TEST_ROOT/existing.db"
INCOMPLETE_DB="$TEST_ROOT/incomplete.db"

cleanup() {
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT INT TERM

if [[ ! -x "$API_PYTHON" ]]; then
  echo "Ambiente Python não encontrado. Execute ./iniciar-local.sh uma vez."
  exit 1
fi

run_alembic() {
  local database="$1"
  shift
  (
    cd "$API_DIR"
    DATABASE_URL="sqlite:///$database" \
      ENVIRONMENT=test \
      SEED_DEMO_DATA=false \
      "$API_PYTHON" -m alembic "$@"
  )
}

run_adoption_check() {
  local database="$1"
  (
    cd "$ROOT_DIR"
    DATABASE_URL="sqlite:///$database" \
      ENVIRONMENT=test \
      SEED_DEMO_DATA=false \
      "$API_PYTHON" -m apps.api.app.schema_adoption
  )
}

echo "[1/4] Alembic em SQLite vazio..."
run_alembic "$EMPTY_DB" upgrade head
run_alembic "$EMPTY_DB" current | rg -q "$BASELINE_REVISION"
run_alembic "$EMPTY_DB" upgrade head
run_alembic "$EMPTY_DB" check
DATABASE_URL="sqlite:///$EMPTY_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
from sqlalchemy import inspect

from apps.api.app.database import engine

tables = set(inspect(engine).get_table_names())
expected = {
    "users",
    "role_configs",
    "tickets",
    "ticket_comments",
    "assets",
    "inventory_secretariats",
    "inventory_sectors",
    "inventory_contracts",
    "asset_movements",
    "inventory_delivery_terms",
    "inventory_delivery_term_items",
    "audit_logs",
    "alembic_version",
}
missing = expected - tables
assert not missing, f"tabelas ausentes após upgrade: {sorted(missing)}"
print("SQLite vazio: OK")
PY

echo "[2/4] Adoção de banco existente compatível..."
DATABASE_URL="sqlite:///$EXISTING_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
from apps.api.app.database import Base, SessionLocal, engine
import apps.api.app.models  # noqa: F401
from apps.api.app.models import User

Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    db.add(
        User(
            username="admin",
            full_name="Admin Compatível",
            email="admin@adcetei.cabofrio.rj.gov.br",
            password_hash="hash-temporario",
            role="admin",
            secretariat="Secretaria de Gestão e Inovação",
            department="ADCETEI",
            source="local",
            active=True,
        )
    )
    db.commit()
PY
run_adoption_check "$EXISTING_DB"
run_alembic "$EXISTING_DB" stamp "$BASELINE_REVISION"
run_alembic "$EXISTING_DB" upgrade head
DATABASE_URL="sqlite:///$EXISTING_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
from sqlalchemy import text

from apps.api.app.database import engine

with engine.connect() as connection:
    users = connection.execute(text("select username from users")).scalars().all()
    revision = connection.execute(text("select version_num from alembic_version")).scalar_one()
assert users == ["admin"], f"dados alterados após adoção: {users}"
assert revision == "20260717_0001", revision
print("Adoção compatível: OK")
PY

echo "[3/4] Recusa de banco incompleto..."
INCOMPLETE_DB="$INCOMPLETE_DB" "$API_PYTHON" - <<'PY'
import os
import sqlite3

with sqlite3.connect(os.environ["INCOMPLETE_DB"]) as connection:
    connection.execute("create table users (id integer primary key, username varchar(120))")
    connection.execute("insert into users (id, username) values (1, 'parcial')")
PY
set +e
ADOPTION_OUTPUT="$(run_adoption_check "$INCOMPLETE_DB" 2>&1)"
ADOPTION_STATUS=$?
set -e
if [[ "$ADOPTION_STATUS" == "0" ]]; then
  echo "$ADOPTION_OUTPUT"
  echo "Verificador aceitou banco incompleto."
  exit 1
fi
[[ "$ADOPTION_OUTPUT" == *"Tabela ausente"* || "$ADOPTION_OUTPUT" == *"Coluna ausente"* ]]
INCOMPLETE_DB="$INCOMPLETE_DB" "$API_PYTHON" - <<'PY'
import os
import sqlite3

with sqlite3.connect(os.environ["INCOMPLETE_DB"]) as connection:
    tables = {
        row[0]
        for row in connection.execute("select name from sqlite_master where type = 'table'").fetchall()
    }
assert "alembic_version" not in tables, "banco incompleto recebeu stamp indevido"
print("Banco incompleto: OK")
PY

echo "[4/4] Compatibilidade dos models após baseline..."
DATABASE_URL="sqlite:///$EMPTY_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
from sqlalchemy import inspect, select

from apps.api.app.database import SessionLocal, engine
from apps.api.app.main import app
from apps.api.app.models import Asset, InventoryDeliveryTerm, Ticket, User

assert app.title == "Portal Interno ADCETEI"
assert {"users", "tickets", "assets", "inventory_delivery_terms"} <= set(inspect(engine).get_table_names())
with SessionLocal() as db:
    db.execute(select(User).limit(1)).all()
    db.execute(select(Ticket).limit(1)).all()
    db.execute(select(Asset).limit(1)).all()
    db.execute(select(InventoryDeliveryTerm).limit(1)).all()
print("Models compatíveis: OK")
PY

echo "Alembic self-check: OK"
