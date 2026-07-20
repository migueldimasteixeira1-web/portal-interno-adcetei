#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
API_PYTHON="$API_DIR/.venv/bin/python"
BASELINE_REVISION="20260717_0001"
TEST_ROOT="$(mktemp -d)"
SQLITE_DB="$TEST_ROOT/empty.db"
OLD_DB="$TEST_ROOT/old.db"
ADMIN_DB="$TEST_ROOT/admin-without-schema.db"
API_PID=""
PG_CONTAINER="portal-alembic-check-$$"

stop_api() {
  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
    API_PID=""
  fi
}

cleanup() {
  local exit_code=$?
  stop_api
  docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$TEST_ROOT"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

if [[ ! -x "$API_PYTHON" ]]; then
  echo "Ambiente Python não encontrado. Execute ./iniciar-local.sh uma vez."
  exit 1
fi
command -v docker >/dev/null 2>&1 || {
  echo "Docker é obrigatório para validar o baseline no PostgreSQL temporário."
  exit 1
}

run_alembic() {
  local database_url="$1"
  shift
  (
    cd "$API_DIR"
    DATABASE_URL="$database_url" \
      ENVIRONMENT=test \
      SEED_DEMO_DATA=false \
      "$API_PYTHON" -m alembic "$@"
  )
}

start_api() {
  local database_url="$1"
  local port="$2"
  local log_file="$TEST_ROOT/api-$port.log"

  stop_api
  (
    cd "$ROOT_DIR"
    DATABASE_URL="$database_url" \
      ENVIRONMENT=test \
      SEED_DEMO_DATA=false \
      SECRET_KEY="chave-temporaria-alembic-self-check" \
      "$API_PYTHON" -m uvicorn apps.api.app.main:app \
        --host 127.0.0.1 --port "$port" --log-level warning
  ) >"$log_file" 2>&1 &
  API_PID=$!

  for _ in {1..120}; do
    if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
      return
    fi
    sleep 0.25
  done

  cat "$log_file"
  echo "A API não iniciou após as migrations."
  exit 1
}

SQLITE_URL="sqlite:///$SQLITE_DB"

echo "[1/6] Baseline e idempotência em SQLite vazio..."
run_alembic "$SQLITE_URL" upgrade head
run_alembic "$SQLITE_URL" upgrade head
run_alembic "$SQLITE_URL" current | rg -q "$BASELINE_REVISION"
run_alembic "$SQLITE_URL" check
DATABASE_URL="$SQLITE_URL" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
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

echo "[2/6] Criação de administrador após migrations..."
(
  cd "$ROOT_DIR"
  DATABASE_URL="$SQLITE_URL" \
    ENVIRONMENT=test \
    SEED_DEMO_DATA=false \
    PORTAL_ADMIN_PASSWORD="SenhaAdminTeste123" \
    "$API_PYTHON" -m apps.api.app.create_admin \
      --full-name "Administrador Teste" \
      --email "administrador@adcetei.cabofrio.rj.gov.br"
)
DATABASE_URL="$SQLITE_URL" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
from sqlalchemy import text

from apps.api.app.database import engine

with engine.connect() as connection:
    role = connection.execute(
        text("select role from users where email = 'administrador@adcetei.cabofrio.rj.gov.br'")
    ).scalar_one()
assert role == "admin"
print("Criação de administrador: OK")
PY

echo "[3/6] API iniciando após migrations..."
start_api "$SQLITE_URL" 18030
stop_api
echo "API com SQLite migrado: OK"

echo "[4/6] Falha segura para bancos sem versão..."
OLD_DB="$OLD_DB" "$API_PYTHON" - <<'PY'
import os
import sqlite3

with sqlite3.connect(os.environ["OLD_DB"]) as connection:
    connection.execute("create table users (id integer primary key, username varchar(120))")
    connection.execute("insert into users (id, username) values (1, 'legado')")
PY
set +e
OLD_OUTPUT="$(run_alembic "sqlite:///$OLD_DB" upgrade head 2>&1)"
OLD_STATUS=$?
set -e
if [[ "$OLD_STATUS" == "0" ]]; then
  echo "$OLD_OUTPUT"
  echo "Alembic aceitou banco antigo sem versão."
  exit 1
fi
[[ "$OLD_OUTPUT" == *"Faça backup/exportação dos dados"* ]]
[[ "$OLD_OUTPUT" == *"configure um banco vazio"* ]]
OLD_DB="$OLD_DB" "$API_PYTHON" - <<'PY'
import os
import sqlite3

with sqlite3.connect(os.environ["OLD_DB"]) as connection:
    tables = {
        row[0]
        for row in connection.execute("select name from sqlite_master where type = 'table'")
    }
    users = connection.execute("select username from users").fetchall()
assert tables == {"users"}, tables
assert users == [("legado",)]
print("Banco antigo permaneceu intacto: OK")
PY

set +e
ADMIN_OUTPUT="$(
  cd "$ROOT_DIR" &&
  DATABASE_URL="sqlite:///$ADMIN_DB" \
    ENVIRONMENT=test \
    SEED_DEMO_DATA=false \
    PORTAL_ADMIN_PASSWORD="SenhaAdminTeste123" \
    "$API_PYTHON" -m apps.api.app.create_admin \
      --full-name "Administrador Teste" \
      --email "administrador@adcetei.cabofrio.rj.gov.br" 2>&1
)"
ADMIN_STATUS=$?
set -e
[[ "$ADMIN_STATUS" != "0" ]]
[[ "$ADMIN_OUTPUT" == *'Execute `alembic upgrade head`'* ]]
echo "Create admin sem schema: OK"

echo "[5/6] Baseline e idempotência em PostgreSQL temporário..."
docker run -d --rm \
  --name "$PG_CONTAINER" \
  -e POSTGRES_DB=portal_test \
  -e POSTGRES_USER=portal_test \
  -e POSTGRES_PASSWORD=portal_test_password \
  -p 127.0.0.1::5432 \
  postgres:16-alpine >/dev/null
for _ in {1..60}; do
  if docker exec "$PG_CONTAINER" pg_isready -U portal_test -d portal_test >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
docker exec "$PG_CONTAINER" pg_isready -U portal_test -d portal_test >/dev/null
PG_PORT="$(docker port "$PG_CONTAINER" 5432/tcp | awk -F: 'NR == 1 {print $NF}')"
PG_URL="postgresql+psycopg://portal_test:portal_test_password@127.0.0.1:$PG_PORT/portal_test"
run_alembic "$PG_URL" upgrade head
run_alembic "$PG_URL" upgrade head
run_alembic "$PG_URL" current | rg -q "$BASELINE_REVISION"
run_alembic "$PG_URL" check
start_api "$PG_URL" 18031
stop_api
echo "PostgreSQL temporário e API: OK"

echo "[6/6] Ausência de criação silenciosa fora das migrations..."
if rg -n "Base\\.metadata\\.create_all|ensure_schema_compatibility|schema_adoption|alembic[[:space:]]+stamp" \
  -g '!alembic-self-check.sh' \
  "$ROOT_DIR/apps" "$ROOT_DIR/scripts" "$ROOT_DIR/iniciar-local.sh"; then
  echo "Foi encontrada criação ou adoção de schema fora do Alembic."
  exit 1
fi

echo "Alembic self-check: OK"
