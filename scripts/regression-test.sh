#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PYTHON="$ROOT_DIR/apps/api/.venv/bin/python"
TEST_ROOT="$(mktemp -d)"
AUTH_DB="$TEST_ROOT/auth.db"
EMPTY_DB="$TEST_ROOT/empty.db"
MIGRATION_DB="$TEST_ROOT/migration.db"
BASE_PORT="${TEST_PORT:-18010}"
API_PID=""

cleanup() {
  local exit_code=$?
  stop_api
  rm -rf "$TEST_ROOT"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

stop_api() {
  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
    API_PID=""
  fi
}

start_api() {
  local mode="$1"
  local seed="$2"
  local database="$3"
  local port="$4"
  local log_file="$TEST_ROOT/api-$port.log"

  stop_api
  (
    cd "$ROOT_DIR"
    ENVIRONMENT=test \
    AUTH_MODE="$mode" \
    SEED_DEMO_DATA="$seed" \
    DATABASE_URL="sqlite:///$database" \
    SECRET_KEY="chave-regressao-local" \
    "$API_PYTHON" -m uvicorn apps.api.app.main:app \
      --host 127.0.0.1 --port "$port" --log-level info
  ) >"$log_file" 2>&1 &
  API_PID=$!

  for _ in {1..300}; do
    if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
      return
    fi
    sleep 0.25
  done

  cat "$log_file"
  echo "A API não iniciou na porta $port."
  exit 1
}

login_status() {
  local port="$1"
  local username="$2"
  local password="$3"
  curl -sS -o "$TEST_ROOT/login-body.json" -w '%{http_code}' \
    -X POST "http://127.0.0.1:$port/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$username\",\"password\":\"$password\"}"
}

if [[ ! -x "$API_PYTHON" ]]; then
  echo "Ambiente Python não encontrado. Execute ./iniciar-local.sh uma vez."
  exit 1
fi

"$API_PYTHON" -c "import uvicorn" >/dev/null

echo "[1/9] Validando helpers de formulário, e-mail e inventário..."
ENVIRONMENT=test "$API_PYTHON" - <<'PY'
from apps.api.app.catalog_forms import normalize_form_schema, validate_form_data
from apps.api.app.auth import validate_institutional_email
from apps.api.app.inventory_service import (
    build_asset_display_name,
    default_sector_update_error,
    initial_inventory_status,
    normalize_serial_number,
    validate_shipping_date_for_status,
)

schema = normalize_form_schema({
    "fields": [
        {"key": "email", "label": "E-mail", "type": "email", "max_length": "inválido"},
        {"key": "date", "label": "Data", "type": "date"},
    ]
})
assert schema["fields"][0]["max_length"] == 500

for values in (
    {"email": "email-invalido", "date": "2026-06-15"},
    {"email": "usuario@cabofrio.rj.gov.br", "date": "2026-02-30"},
):
    try:
        validate_form_data(schema, values)
    except ValueError:
        pass
    else:
        raise AssertionError("valor inválido aceito pelo formulário dinâmico")

assert validate_institutional_email("Miguel.Teixeira@ADCETEI.CABOFRIO.RJ.GOV.BR") == "miguel.teixeira@adcetei.cabofrio.rj.gov.br"
for email in ("usuario@cabofrio.rj.gov.br", "usuario@gmail.com", "usuario@adcetei.gov.br"):
    try:
        validate_institutional_email(email)
    except Exception:
        pass
    else:
        raise AssertionError(f"e-mail institucional inválido aceito: {email}")
assert normalize_serial_number("  AB  123  / Série  ") == "ab 123 / série"
assert initial_inventory_status(" ADCETEI ", None) == "stock"
assert initial_inventory_status("Escola Municipal", None) == "allocated"
assert initial_inventory_status("ADCETEI", 12) == "allocated"
try:
    validate_shipping_date_for_status("allocated", None)
except ValueError:
    pass
else:
    raise AssertionError("equipamento alocado sem data de envio foi aceito")
assert build_asset_display_name("Notebook", "Dell", "Latitude", " SN 123 ") == "Notebook - Dell - Latitude - SN 123"
assert "PAT" not in build_asset_display_name(serial_number="SN-9")
assert default_sector_update_error({"is_active": False}, current_name="ADCETEI") is not None
assert default_sector_update_error({"name": "Outro setor"}, current_name=" ADCETEI ") is not None
assert default_sector_update_error({"is_active": True}, current_name="ADCETEI") is None
assert default_sector_update_error({"is_active": False}, current_name="Escola Municipal") is None
print("Helpers: OK")
PY

echo "[2/9] Validando migração não destrutiva do schema legado..."
MIGRATION_DB="$MIGRATION_DB" DATABASE_URL="sqlite:///$MIGRATION_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
import os
import sqlite3

from sqlalchemy import inspect

from apps.api.app.database import engine, ensure_schema_compatibility

with sqlite3.connect(os.environ["MIGRATION_DB"]) as connection:
    connection.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(120), email VARCHAR(180), role VARCHAR(40), created_at TIMESTAMP)")
    connection.execute("INSERT INTO users (id, username, email, role, created_at) VALUES (1, 'admin', 'admin@adcetei.cabofrio.rj.gov.br', 'admin', CURRENT_TIMESTAMP)")
    connection.execute("INSERT INTO users (id, username, email, role, created_at) VALUES (2, 'legado', 'legado@cabofrio.rj.gov.br', 'requester', CURRENT_TIMESTAMP)")
    connection.execute("INSERT INTO users (id, username, email, role, created_at) VALUES (3, 'suporte', 'suporte@adcetei.cabofrio.rj.gov.br', 'helpdesk', CURRENT_TIMESTAMP)")
    connection.execute("CREATE TABLE tickets (id INTEGER PRIMARY KEY, title VARCHAR(220) NOT NULL)")
    connection.execute("CREATE TABLE role_configs (role VARCHAR(40) PRIMARY KEY, label VARCHAR(80), description VARCHAR(300), ldap_group VARCHAR(180), permissions JSON, updated_at TIMESTAMP)")
    connection.execute("INSERT INTO role_configs (role, label, description, ldap_group, permissions) VALUES ('helpdesk', 'Helpdesk', '', '', '[]')")
    connection.execute("INSERT INTO role_configs (role, label, description, ldap_group, permissions) VALUES ('requester', 'Solicitante', '', '', '[]')")
    connection.execute("CREATE TABLE inventory_secretariats (id INTEGER PRIMARY KEY, name VARCHAR(160), normalized_name VARCHAR(180) UNIQUE, is_active BOOLEAN, created_at TIMESTAMP, updated_at TIMESTAMP)")
    connection.execute("INSERT INTO inventory_secretariats (id, name, normalized_name, is_active) VALUES (1, 'Secretaria Existente', 'secretaria existente', 1)")
    connection.execute("CREATE TABLE inventory_sectors (id INTEGER PRIMARY KEY, name VARCHAR(160), normalized_name VARCHAR(180) UNIQUE, secretariat_id INTEGER, is_active BOOLEAN, created_at TIMESTAMP, updated_at TIMESTAMP)")
    connection.execute("INSERT INTO inventory_sectors (id, name, normalized_name, secretariat_id, is_active) VALUES (1, 'ADCETEI', 'adcetei', NULL, 1)")
    connection.execute("INSERT INTO inventory_sectors (id, name, normalized_name, secretariat_id, is_active) VALUES (2, 'FAZENDA', 'fazenda', NULL, 1)")
    connection.execute("INSERT INTO inventory_sectors (id, name, normalized_name, secretariat_id, is_active) VALUES (3, 'Setor Existente', 'setor existente', 1, 1)")

ensure_schema_compatibility()
ensure_schema_compatibility()
columns = {column["name"] for column in inspect(engine).get_columns("tickets")}
expected = {"form_data", "form_schema_snapshot", "service_id"}
assert expected <= columns, f"colunas ausentes após migração: {expected - columns}"
user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
expected_user_columns = {"email_verified_at", "email_verification_token_hash", "email_verification_expires_at", "password_reset_token_hash", "password_reset_expires_at"}
assert expected_user_columns <= user_columns, f"colunas de usuário ausentes: {expected_user_columns - user_columns}"
with sqlite3.connect(os.environ["MIGRATION_DB"]) as connection:
    rows = dict(connection.execute("select username, email_verified_at from users").fetchall())
    assert rows["admin"], "e-mail institucional legado deveria ser preservado como verificado"
    assert rows["legado"] is None, "e-mail legado fora do padrão não deve ser verificado automaticamente"
    user_roles = dict(connection.execute("select username, role from users").fetchall())
    assert user_roles["legado"] == "user", "perfil requester legado deve virar user"
    assert user_roles["suporte"] == "technician", "perfil helpdesk legado deve virar technician"
    roles = {row[0] for row in connection.execute("select role from role_configs").fetchall()}
    assert "helpdesk" not in roles, "perfil helpdesk legado não deve permanecer ativo"
    assert "requester" not in roles, "perfil requester legado não deve permanecer ativo"
    secretariats = dict(connection.execute("select normalized_name, id from inventory_secretariats").fetchall())
    sectors = dict(connection.execute("select normalized_name, secretariat_id from inventory_sectors").fetchall())
    assert "secretaria de governo e integridade" in secretariats, "SGI deve existir como secretaria"
    assert sectors["adcetei"] == secretariats["secretaria de governo e integridade"], "ADCETEI deve pertencer à SGI"
    assert sectors["fazenda"] is None, "FAZENDA sem classificação deve permanecer sem secretaria"
    assert sectors["setor existente"] == 1, "vínculo organizacional existente deve ser preservado"
    assert "secretaria adjunta de ciência e tecnologia" not in secretariats, "migração não deve criar secretaria incorreta"
    assert len([name for name in secretariats if name == "secretaria de governo e integridade"]) == 1, "migração deve ser idempotente"
with engine.connect() as connection:
    assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1, "SQLite deve validar chaves estrangeiras"
print("Migração legada: OK")
PY

echo "[3/9] Validando autenticação por e-mail e criação explícita do seed..."
start_api email true "$AUTH_DB" "$BASE_PORT"
[[ "$(login_status "$BASE_PORT" servidor 123456)" == "422" ]]
[[ "$(login_status "$BASE_PORT" kathlelyn.abreu@sedec.cabofrio.rj.gov.br 123456)" == "200" ]]
[[ "$(login_status "$BASE_PORT" usuario@cabofrio.rj.gov.br 123456)" == "422" ]]

echo "[4/9] Confirmando rejeição de cadastro fora do padrão institucional..."
status=$(curl -sS -o "$TEST_ROOT/register-body.json" -w '%{http_code}' \
  -X POST "http://127.0.0.1:$BASE_PORT/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Usuário Teste","email":"usuario@cabofrio.rj.gov.br","password":"senha-segura-123"}')
[[ "$status" == "422" ]]

echo "[5/9] Confirmando que conta não verificada não entra..."
DATABASE_URL="sqlite:///$AUTH_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
import os
from apps.api.app.auth import hash_password
from apps.api.app.database import SessionLocal
from apps.api.app.models import User

with SessionLocal() as db:
    db.add(
        User(
            username="pendente",
            full_name="Conta Pendente",
            email="conta.pendente@adcetei.cabofrio.rj.gov.br",
            password_hash=hash_password("senha-segura-123"),
            role="user",
            secretariat="Prefeitura de Cabo Frio",
            department="Não informado",
            source="email",
            active=True,
        )
    )
    db.commit()
PY
[[ "$(login_status "$BASE_PORT" conta.pendente@adcetei.cabofrio.rj.gov.br senha-segura-123)" == "403" ]]

echo "[6/9] Confirmando conta legada com e-mail fora do padrão bloqueada..."
DATABASE_URL="sqlite:///$AUTH_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" - <<'PY'
from apps.api.app.auth import hash_password
from apps.api.app.database import SessionLocal
from apps.api.app.models import User
from apps.api.app.time_utils import utc_now

with SessionLocal() as db:
    db.add(
        User(
            username="legado",
            full_name="Usuário Legado",
            email="legado@cabofrio.rj.gov.br",
            password_hash=hash_password("senha-segura-123"),
            role="user",
            secretariat="Prefeitura de Cabo Frio",
            department="Não informado",
            source="local",
            active=True,
            email_verified_at=utc_now(),
        )
    )
    db.commit()
PY
[[ "$(login_status "$BASE_PORT" legado@cabofrio.rj.gov.br senha-segura-123)" == "422" ]]

echo "[7/9] Confirmando seed desabilitado em banco vazio..."
start_api email false "$EMPTY_DB" "$((BASE_PORT + 3))"
[[ "$(login_status "$((BASE_PORT + 3))" kathlelyn.abreu@sedec.cabofrio.rj.gov.br 123456)" == "401" ]]
stop_api
EMPTY_DB="$EMPTY_DB" "$API_PYTHON" - <<'PY'
import os
import sqlite3

with sqlite3.connect(os.environ["EMPTY_DB"]) as connection:
    count = connection.execute("select count(*) from users").fetchone()[0]
    assert count == 0, f"seed desabilitado criou {count} usuário(s)"
PY

echo "[8/9] Confirmando que create_admin recusa e-mail inválido..."
CREATE_ADMIN_DB="$TEST_ROOT/create-admin.db"
set +e
CREATE_OUTPUT=$(cd "$ROOT_DIR" && ENVIRONMENT=test SEED_DEMO_DATA=false DATABASE_URL="sqlite:///$CREATE_ADMIN_DB" PORTAL_ADMIN_PASSWORD="SenhaAdmin123" "$API_PYTHON" -m apps.api.app.create_admin --full-name "Admin Teste" --email "admin@cabofrio.rj.gov.br" 2>&1)
CREATE_STATUS=$?
set -e
[[ "$CREATE_STATUS" != "0" ]]
[[ "$CREATE_OUTPUT" == *"Use seu e-mail institucional"* ]]

echo "[9/9] Executando regressão funcional completa..."
start_api email false "$AUTH_DB" "$((BASE_PORT + 2))"
API_URL="http://127.0.0.1:$((BASE_PORT + 2))/api" TEST_DB="$AUTH_DB" "$API_PYTHON" - <<'PY'
import json
import os
import re
import sqlite3
from io import BytesIO
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from openpyxl import load_workbook

from apps.api.app.auth import verify_password

BASE = os.environ["API_URL"]
DB_PATH = os.environ["TEST_DB"]
ZONE_PATTERN = re.compile(r"(Z|[+-]\d{2}:\d{2})$")


def call(method, path, token=None, payload=None, params=None):
    if params:
        path = f"{path}?{urlencode(params)}"
    headers = {}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode()
    request = Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urlopen(request) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except HTTPError as exc:
        raw = exc.read()
        return exc.code, json.loads(raw) if raw else None


def expect(actual, expected, label):
    if actual != expected:
        raise AssertionError(f"{label}: esperado {expected!r}, recebido {actual!r}")


def login(username, password="123456"):
    status, result = call("POST", "/auth/login", payload={"username": username, "password": password})
    expect(status, 200, f"login {username}")
    return result["access_token"], result["user"]


def assert_explicit_zone(value, label):
    if not value or not ZONE_PATTERN.search(value):
        raise AssertionError(f"{label} não possui fuso explícito: {value!r}")


requester, requester_user = login("kathlelyn.abreu@sedec.cabofrio.rj.gov.br")
operator, _ = login("maiana.ignacio@adcetei.cabofrio.rj.gov.br")
technician, _ = login("lucas.martins@adcetei.cabofrio.rj.gov.br")
admin, admin_user = login("admin@adcetei.cabofrio.rj.gov.br", "admin123")

# Usuário inativo permanece bloqueado.
with sqlite3.connect(DB_PATH) as connection:
    connection.execute("update users set active = 0 where username = 'marcelo'")
    connection.commit()
status, _ = call("POST", "/auth/login", payload={"username": "marcelo.santos@administracao.cabofrio.rj.gov.br", "password": "123456"})
expect(status, 401, "usuário inativo")
with sqlite3.connect(DB_PATH) as connection:
    connection.execute("update users set active = 1 where username = 'marcelo'")
    connection.commit()

# Inventário completo é restrito; opções de abertura são mínimas e do próprio usuário.
status, _ = call("GET", "/assets", requester)
expect(status, 403, "usuário sem inventário completo")
status, options = call("GET", "/assets/ticket-options", requester)
expect(status, 200, "opções resumidas de equipamento")
if not options:
    raise AssertionError("usuário deveria possuir equipamentos vinculados")
allowed_keys = {"id", "name", "asset_type", "patrimony"}
for option in options:
    expect(set(option), allowed_keys, "campos expostos na opção de equipamento")
if any(option["asset_type"] == "network" for option in options):
    raise AssertionError("equipamento de rede de outro usuário foi exposto")

status, full_inventory = call("GET", "/assets", operator)
expect(status, 200, "técnico consulta inventário completo")
if not full_inventory or "ip_address" not in full_inventory[0]:
    raise AssertionError("inventário administrativo não contém os dados completos")
foreign_asset = next(item for item in full_inventory if item.get("assigned_user_id") != requester_user["id"])

status, _ = call("GET", "/inventory/meta", requester)
expect(status, 403, "metadados do inventário exigem inventory.view")
status, _ = call("GET", "/inventory/catalogs", requester)
expect(status, 403, "usuário comum não acessa catálogos de inventário")

status, inventory_meta = call("GET", "/inventory/meta", operator)
expect(status, 200, "metadados do módulo de inventário")
expect(inventory_meta["default_sector"], "ADCETEI", "setor padrão do inventário")
expect(set(inventory_meta["statuses"]), {"stock", "allocated", "maintenance", "retired"}, "status planejados do inventário")
for permission in ("inventory.view", "inventory.create", "inventory.bulk_scan", "inventory.import", "inventory.move", "inventory.edit", "inventory.manage_catalogs", "inventory.audit"):
    if permission not in inventory_meta["permissions"]:
        raise AssertionError(f"permissão de inventário ausente nos metadados: {permission}")

status, catalogs = call("GET", "/inventory/catalogs", admin)
expect(status, 200, "administrador consulta catálogos de inventário")
if not catalogs["secretariats"]:
    raise AssertionError("secretarias ausentes nos catálogos")
default_secretariat = catalogs["secretariats"][0]
if not any(item["name"] == "ADCETEI" and item["is_active"] for item in catalogs["sectors"]):
    raise AssertionError("setor padrão ADCETEI ausente")
default_sector = next(item for item in catalogs["sectors"] if item["name"] == "ADCETEI")
requester_sector = next(item for item in catalogs["sectors"] if item["id"] == requester_user["department_sector_id"])
status, body = call("PATCH", f"/inventory/catalogs/sectors/{default_sector['id']}", admin, {"is_active": False})
expect(status, 400, "setor padrão ADCETEI não pode ser desativado")
if body.get("detail") != "O setor padrão ADCETEI não pode ser renomeado ou desativado.":
    raise AssertionError("mensagem de proteção do setor padrão ausente ao desativar")
status, body = call("PATCH", f"/inventory/catalogs/sectors/{default_sector['id']}", admin, {"name": "Estoque Central"})
expect(status, 400, "setor padrão ADCETEI não pode ser renomeado")
if body.get("detail") != "O setor padrão ADCETEI não pode ser renomeado ou desativado.":
    raise AssertionError("mensagem de proteção do setor padrão ausente ao renomear")
status, _ = call("DELETE", f"/inventory/catalogs/sectors/{default_sector['id']}", admin)
expect(status, 400, "setor padrão ADCETEI não pode ser excluído")
status, protected_sector = call("POST", "/inventory/catalogs/sectors", admin, {"name": "Setor Proteção Regressão", "secretariat_id": default_secretariat["id"]})
expect(status, 201, "administrador cria setor auxiliar para teste de proteção")
status, protected_sector = call("PATCH", f"/inventory/catalogs/sectors/{protected_sector['id']}", admin, {"is_active": False})
expect(status, 200, "outros setores podem ser desativados")
expect(protected_sector["is_active"], False, "setor auxiliar desativado")
status, protected_sector = call(
    "PATCH",
    f"/inventory/catalogs/sectors/{protected_sector['id']}",
    admin,
    {"name": "Setor Proteção Renomeado", "is_active": True, "secretariat_id": default_secretariat["id"]},
)
expect(status, 200, "outros setores podem ser renomeados e reativados")
expect(protected_sector["name"], "Setor Proteção Renomeado", "setor auxiliar renomeado")
status, _ = call("POST", "/inventory/catalogs/sectors", admin, {"name": "  adcetei  ", "secretariat_id": default_secretariat["id"]})
expect(status, 409, "setor padrão não pode ser duplicado")

status, supplier = call("POST", "/inventory/catalogs/suppliers", admin, {"name": "Fornecedor Teste"})
expect(status, 201, "administrador cria fornecedor")
status, _ = call("POST", "/inventory/catalogs/suppliers", admin, {"name": " fornecedor   teste "})
expect(status, 409, "fornecedor duplicado bloqueado")
status, supplier = call("PATCH", f"/inventory/catalogs/suppliers/{supplier['id']}", admin, {"is_active": False})
expect(status, 200, "administrador inativa fornecedor")
expect(supplier["is_active"], False, "fornecedor inativado")
status, supplier = call("PATCH", f"/inventory/catalogs/suppliers/{supplier['id']}", admin, {"is_active": True})
expect(status, 200, "administrador reativa fornecedor")
expect(supplier["is_active"], True, "fornecedor reativado")
status, temporary_supplier = call("POST", "/inventory/catalogs/suppliers", admin, {"name": "Fornecedor Excluir Regressão"})
expect(status, 201, "administrador cria fornecedor temporário")
status, _ = call("DELETE", f"/inventory/catalogs/suppliers/{temporary_supplier['id']}", admin)
expect(status, 200, "administrador exclui fornecedor sem vínculo")
status, catalogs_after_delete = call("GET", "/inventory/catalogs", admin)
expect(status, 200, "administrador consulta catálogos após exclusão")
if any(item["id"] == temporary_supplier["id"] for item in catalogs_after_delete["suppliers"]):
    raise AssertionError("fornecedor temporário não foi excluído")

status, equipment_type = call("POST", "/inventory/catalogs/equipment-types", admin, {"name": "Projetor"})
expect(status, 201, "administrador cria tipo de equipamento")
status, manufacturer = call("POST", "/inventory/catalogs/manufacturers", admin, {"name": "Dell"})
expect(status, 201, "administrador cria fabricante")
status, _ = call(
    "POST",
    "/inventory/catalogs/models",
    admin,
    {"name": "Latitude 5440", "manufacturer_id": 999999, "equipment_type_id": equipment_type["id"]},
)
expect(status, 400, "modelo com fabricante inexistente bloqueado")
status, _ = call(
    "POST",
    "/inventory/catalogs/models",
    admin,
    {"name": "Latitude 5440", "manufacturer_id": manufacturer["id"], "equipment_type_id": 999999},
)
expect(status, 400, "modelo com tipo inexistente bloqueado")
status, equipment_model = call(
    "POST",
    "/inventory/catalogs/models",
    admin,
    {"name": "Latitude 5440", "manufacturer_id": manufacturer["id"], "equipment_type_id": equipment_type["id"]},
)
expect(status, 201, "administrador cria modelo")
expect(equipment_model["manufacturer_id"], manufacturer["id"], "fabricante vinculado ao modelo")
status, _ = call(
    "POST",
    "/inventory/catalogs/models",
    admin,
    {"name": " latitude   5440 ", "manufacturer_id": manufacturer["id"], "equipment_type_id": equipment_type["id"]},
)
expect(status, 409, "modelo duplicado bloqueado")

status, _ = call(
    "POST",
    "/inventory/assets",
    requester,
    {
        "serial_number": "REQ-SEM-PERMISSAO",
        "supplier_id": supplier["id"],
        "equipment_type_id": equipment_type["id"],
        "manufacturer_id": manufacturer["id"],
        "equipment_model_id": equipment_model["id"],
    },
)
expect(status, 403, "usuário comum não cria equipamento")

status, modular_asset = call(
    "POST",
    "/inventory/assets",
    admin,
    {
        "serial_number": "  SN   MOD-001  ",
        "supplier_id": supplier["id"],
        "equipment_type_id": equipment_type["id"],
        "manufacturer_id": manufacturer["id"],
        "equipment_model_id": equipment_model["id"],
        "notes": "Criado pela regressão do contrato modular.",
    },
)
expect(status, 201, "administrador cria equipamento modular")
expect(modular_asset["serial_number"], "SN MOD-001", "serial normalizado sem destruir caracteres")
expect(modular_asset["status"], "stock", "equipamento sem setor externo e responsável entra em estoque")
expect(modular_asset["supplier"]["name"], supplier["name"], "fornecedor no contrato novo")
expect(modular_asset["equipment_type"]["name"], equipment_type["name"], "tipo no contrato novo")
expect(modular_asset["manufacturer"]["name"], manufacturer["name"], "fabricante no contrato novo")
expect(modular_asset["equipment_model"]["name"], equipment_model["name"], "modelo no contrato novo")
expect(modular_asset["sector"]["name"], "ADCETEI", "setor padrão no contrato novo")
if "Latitude 5440" not in modular_asset["display_name"] or "SN MOD-001" not in modular_asset["display_name"]:
    raise AssertionError(f"display name incompleto: {modular_asset['display_name']}")

status, deletable_asset = call(
    "POST",
    "/inventory/assets",
    admin,
    {
        "serial_number": "SN-EXCLUIR-001",
        "supplier_id": supplier["id"],
        "equipment_type_id": equipment_type["id"],
        "manufacturer_id": manufacturer["id"],
        "equipment_model_id": equipment_model["id"],
        "notes": "Equipamento temporário para teste de exclusão.",
    },
)
expect(status, 201, "administrador cria equipamento temporário")
status, _ = call("DELETE", f"/inventory/assets/{deletable_asset['id']}", admin)
expect(status, 200, "administrador exclui equipamento sem chamado vinculado")
status, _ = call("GET", f"/inventory/assets/{deletable_asset['id']}", admin)
expect(status, 404, "equipamento excluído não aparece no detalhe")

status, _ = call(
    "POST",
    "/inventory/assets",
    admin,
    {
        "serial_number": "sn mod-001",
        "supplier_id": supplier["id"],
        "equipment_type_id": equipment_type["id"],
        "manufacturer_id": manufacturer["id"],
        "equipment_model_id": equipment_model["id"],
    },
)
expect(status, 409, "serial duplicado bloqueado por comparação normalizada")

status, other_manufacturer = call("POST", "/inventory/catalogs/manufacturers", admin, {"name": "Fabricante Regressao"})
expect(status, 201, "administrador cria fabricante alternativo")
status, _ = call(
    "POST",
    "/inventory/assets",
    admin,
    {
        "serial_number": "SN-MODELO-INCOMPATIVEL",
        "equipment_type_id": equipment_type["id"],
        "manufacturer_id": other_manufacturer["id"],
        "equipment_model_id": equipment_model["id"],
    },
)
expect(status, 400, "modelo incompatível com fabricante bloqueado")

bulk_payload = {
    "supplier_id": supplier["id"],
    "equipment_type_id": equipment_type["id"],
    "manufacturer_id": manufacturer["id"],
    "equipment_model_id": equipment_model["id"],
    "received_at": "2026-07-02",
    "serial_numbers": ["SN-BULK-001", "SN-BULK-002"],
    "notes": "Entrada em lote pela regressão.",
}
status, _ = call("POST", "/inventory/assets/bulk-scan/preview", requester, bulk_payload)
expect(status, 403, "usuário comum não faz preview de lote")
status, _ = call("POST", "/inventory/assets/bulk-scan/confirm", requester, bulk_payload)
expect(status, 403, "usuário comum não confirma lote")

status, bulk_preview = call("POST", "/inventory/assets/bulk-scan/preview", admin, bulk_payload)
expect(status, 200, "administrador faz preview de lote válido")
expect(bulk_preview["total"], 2, "preview contabiliza total enviado")
expect(bulk_preview["valid_count"], 2, "preview contabiliza itens válidos")
expect(bulk_preview["invalid_count"], 0, "preview válido não tem erros")

status, duplicate_preview = call(
    "POST",
    "/inventory/assets/bulk-scan/preview",
    admin,
    {**bulk_payload, "serial_numbers": ["SN-BULK-DUP", " sn-bulk-dup ", "SN-BULK-OK"]},
)
expect(status, 200, "preview de lote com duplicado local")
expect(duplicate_preview["valid_count"], 2, "duplicado local mantém itens únicos válidos")
expect(duplicate_preview["invalid_count"], 1, "duplicado local gera erro")
if duplicate_preview["errors"][0]["message"] != "Número de série duplicado no lote":
    raise AssertionError("preview não identificou duplicado dentro do lote")

status, existing_preview = call(
    "POST",
    "/inventory/assets/bulk-scan/preview",
    admin,
    {**bulk_payload, "serial_numbers": ["sn mod-001"]},
)
expect(status, 200, "preview de lote com serial existente")
expect(existing_preview["valid_count"], 0, "serial existente não é válido")
expect(existing_preview["invalid_count"], 1, "serial existente gera erro")
if existing_preview["errors"][0]["message"] != "Número de série já cadastrado":
    raise AssertionError("preview não identificou serial existente")

status, _ = call(
    "POST",
    "/inventory/assets/bulk-scan/preview",
    admin,
    {**bulk_payload, "manufacturer_id": other_manufacturer["id"]},
)
expect(status, 400, "preview bloqueia modelo incompatível com fabricante")

status, before_bulk_assets = call("GET", "/inventory/assets", admin, params={"page_size": 100})
expect(status, 200, "lista antes do lote inválido")
expect("items" in before_bulk_assets and "total" in before_bulk_assets, True, "lista paginada do inventário")
status, _ = call(
    "POST",
    "/inventory/assets/bulk-scan/confirm",
    admin,
    {**bulk_payload, "serial_numbers": ["SN-BULK-ROLLBACK", "SN MOD-001"]},
)
expect(status, 409, "confirm revalida e bloqueia lote com erro")
status, after_failed_bulk_assets = call("GET", "/inventory/assets", admin, params={"page_size": 100})
expect(status, 200, "lista após lote inválido")
expect(after_failed_bulk_assets["total"], before_bulk_assets["total"], "confirm inválido não cria parcialmente")
if any(item["serial_number"] == "SN-BULK-ROLLBACK" for item in after_failed_bulk_assets["items"]):
    raise AssertionError("confirm inválido criou item parcial")

status, bulk_confirm = call("POST", "/inventory/assets/bulk-scan/confirm", admin, bulk_payload)
expect(status, 200, "administrador confirma lote válido")
expect(bulk_confirm["created_count"], 2, "confirm retorna quantidade criada")
expect(bulk_confirm["summary"]["valid_count"], 2, "confirm retorna resumo do preview")
for created in bulk_confirm["assets"]:
    expect(created["status"], "stock", "lote cria equipamento em estoque")
    expect(created["sector"]["name"], "ADCETEI", "lote entra no setor padrão")
    expect(created["assigned_user"], None, "lote não vincula responsável")
    expect(created["delivered_at"], None, "lote não define data de envio")
    expect(created["received_at"] is not None, True, "lote define data de recebimento")
    status, created_movements = call("GET", f"/inventory/assets/{created['id']}/movements", admin)
    expect(status, 200, "histórico de item do lote")
    created_movement = next((item for item in created_movements if item["action"] == "created"), None)
    if not created_movement or created_movement["to_sector"]["name"] != "ADCETEI" or created_movement["to_status"] != "stock":
        raise AssertionError("item do lote não registrou movimento inicial created")

status, external_sector = call("POST", "/inventory/catalogs/sectors", admin, {"name": "Escola Municipal", "secretariat_id": default_secretariat["id"]})
expect(status, 201, "administrador cria setor externo")
status, _ = call(
    "POST",
    "/inventory/assets",
    admin,
    {
        "serial_number": "SN-SEM-ENTREGA",
        "equipment_type_id": equipment_type["id"],
        "manufacturer_id": manufacturer["id"],
        "equipment_model_id": equipment_model["id"],
        "sector_id": external_sector["id"],
    },
)
expect(status, 422, "setor externo exige data de entrega")
status, _ = call(
    "POST",
    "/inventory/assets",
    admin,
    {
        "serial_number": "SN-RESP-SEM-ENTREGA",
        "equipment_type_id": equipment_type["id"],
        "manufacturer_id": manufacturer["id"],
        "equipment_model_id": equipment_model["id"],
        "sector_id": requester_sector["id"],
        "assigned_user_id": requester_user["id"],
    },
)
expect(status, 422, "responsável exige data de entrega")

status, allocated_asset = call(
    "POST",
    "/inventory/assets",
    admin,
    {
        "serial_number": "SN-ALOCADO-001",
        "equipment_type_id": equipment_type["id"],
        "manufacturer_id": manufacturer["id"],
        "equipment_model_id": equipment_model["id"],
        "sector_id": requester_sector["id"],
        "assigned_user_id": requester_user["id"],
        "delivered_at": "2026-07-02T12:00:00-03:00",
    },
)
expect(status, 201, "administrador cria equipamento alocado")
expect(allocated_asset["status"], "allocated", "responsável coloca equipamento como alocado")
expect(allocated_asset["assigned_user"]["id"], requester_user["id"], "responsável no contrato novo")

status, listed_assets = call("GET", "/inventory/assets", admin, params={"status_filter": "stock", "page_size": 100})
expect(status, 200, "administrador lista equipamentos no contrato novo")
if not any(item["id"] == modular_asset["id"] for item in listed_assets["items"]):
    raise AssertionError("equipamento em estoque não retornou no filtro do contrato novo")
status, secretariat_assets = call("GET", "/inventory/assets", admin, params={"secretariat_id": requester_sector["secretariat_id"], "page_size": 100})
expect(status, 200, "administrador filtra inventário por secretaria")
if not secretariat_assets["items"] or any(item["sector"]["secretariat_id"] != requester_sector["secretariat_id"] for item in secretariat_assets["items"]):
    raise AssertionError("filtro por secretaria retornou item de outra secretaria")

def call_binary(method, path, token=None, params=None):
    if params:
        path = f"{path}?{urlencode(params)}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(BASE + path, headers=headers, method=method)
    try:
        with urlopen(request) as response:
            return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read()
    except HTTPError as exc:
        return exc.code, {key.lower(): value for key, value in exc.headers.items()}, exc.read()


status, _, _ = call_binary("GET", "/inventory/assets/export", requester)
expect(status, 403, "usuário comum não exporta inventário")
status, export_headers, export_body = call_binary("GET", "/inventory/assets/export", admin, params={"status_filter": "stock", "secretariat_id": requester_sector["secretariat_id"]})
expect(status, 200, "administrador exporta inventário filtrado")
if "spreadsheetml" not in export_headers.get("content-type", ""):
    raise AssertionError("exportação não retornou xlsx")
if export_body[:2] != b"PK":
    raise AssertionError("arquivo xlsx inválido")
if "inventario_adcetei" not in export_headers.get("content-disposition", ""):
    raise AssertionError("nome de arquivo de exportação ausente")
workbook = load_workbook(BytesIO(export_body), read_only=True)
headers = [cell.value for cell in next(workbook["Inventário"].iter_rows(min_row=6, max_row=6))]
expect(headers[5], "Secretaria", "exportação coloca secretaria antes do setor")
expect(headers[6], "Setor", "exportação mantém setor após secretaria")

status, detailed_asset = call("GET", f"/inventory/assets/{allocated_asset['id']}", admin)
expect(status, 200, "administrador detalha equipamento modular")
expect(detailed_asset["status"], "allocated", "detalhe converte active legado para allocated")

status, created_movements = call("GET", f"/inventory/assets/{modular_asset['id']}/movements", admin)
expect(status, 200, "administrador lista histórico de equipamento")
if not any(item["action"] == "created" for item in created_movements):
    raise AssertionError("cadastro modular não registrou movimentação inicial")

status, _ = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/allocate",
    requester,
    {"sector_id": external_sector["id"], "assigned_user_id": requester_user["id"], "movement_date": "2026-07-02"},
)
expect(status, 403, "usuário comum sem inventory.move não movimenta equipamento")

status, _ = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/allocate",
    admin,
    {
        "sector_id": external_sector["id"],
        "assigned_user_id": requester_user["id"],
        "movement_date": "2026-07-02",
        "notes": "Entregue ao setor pela regressão.",
    },
)
expect(status, 400, "responsável fora do setor não pode receber equipamento")

status, moved_asset = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/allocate",
    admin,
    {
        "sector_id": requester_sector["id"],
        "assigned_user_id": requester_user["id"],
        "movement_date": "2026-07-02",
        "notes": "Entregue ao setor pela regressão.",
    },
)
expect(status, 200, "administrador aloca equipamento")
expect(moved_asset["status"], "allocated", "alocação muda status para alocado")
expect(moved_asset["sector"]["id"], requester_sector["id"], "alocação muda setor")
expect(moved_asset["assigned_user"]["id"], requester_user["id"], "alocação vincula responsável")
assert_explicit_zone(moved_asset["delivered_at"], "inventário.delivered_at")
status, movements = call("GET", f"/inventory/assets/{modular_asset['id']}/movements", admin)
expect(status, 200, "histórico após alocação")
allocated_movement = next((item for item in movements if item["action"] == "allocated"), None)
if not allocated_movement or allocated_movement["to_sector"]["id"] != requester_sector["id"] or allocated_movement["to_user"]["id"] != requester_user["id"]:
    raise AssertionError("histórico não registrou alocação com setor/responsável")

status, same_sector_user = call(
    "POST",
    "/admin/users",
    admin,
    {
        "username": "mesmo.setor",
        "full_name": "Usuário Mesmo Setor",
        "email": "mesmo.setor@adcetei.cabofrio.rj.gov.br",
        "password": "SenhaTeste123",
        "role": "user",
        "secretariat": requester_user["secretariat"],
        "department_sector_id": requester_sector["id"],
        "department": requester_sector["name"],
        "phone": "",
        "active": True,
    },
)
expect(status, 201, "administrador cria usuário no mesmo setor para movimentação")

status, _ = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/change-responsible",
    admin,
    {
        "assigned_user_id": admin_user["id"],
        "movement_date": "2026-07-03",
        "notes": "Troca de responsável pela regressão.",
    },
)
expect(status, 400, "troca para responsável de outro setor é bloqueada")

status, moved_asset = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/change-responsible",
    admin,
    {
        "assigned_user_id": same_sector_user["id"],
        "movement_date": "2026-07-03",
        "notes": "Troca de responsável pela regressão.",
    },
)
expect(status, 200, "administrador troca responsável")
expect(moved_asset["assigned_user"]["id"], same_sector_user["id"], "responsável atualizado")
expect(moved_asset["status"], "allocated", "troca mantém equipamento alocado")
status, movements = call("GET", f"/inventory/assets/{modular_asset['id']}/movements", admin)
responsible_movement = next((item for item in movements if item["action"] == "responsible_changed"), None)
if not responsible_movement or responsible_movement["from_user"]["id"] != requester_user["id"] or responsible_movement["to_user"]["id"] != same_sector_user["id"]:
    raise AssertionError("histórico não registrou troca de responsável")

status, moved_asset = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/return-to-stock",
    admin,
    {"movement_date": "2026-07-04", "notes": "Devolvido à ADCETEI pela regressão."},
)
expect(status, 200, "administrador devolve ao estoque")
expect(moved_asset["status"], "stock", "devolução muda status para estoque")
expect(moved_asset["sector"]["name"], "ADCETEI", "devolução volta ao setor padrão")
expect(moved_asset["assigned_user"], None, "devolução limpa responsável")
expect(moved_asset["delivered_at"], None, "devolução limpa data de entrega")
status, movements = call("GET", f"/inventory/assets/{modular_asset['id']}/movements", admin)
returned_movement = next((item for item in movements if item["action"] == "returned_to_stock"), None)
if not returned_movement or returned_movement["to_sector"]["name"] != "ADCETEI" or returned_movement["to_user"] is not None:
    raise AssertionError("histórico não registrou devolução ao estoque")

status, moved_asset = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/maintenance",
    admin,
    {"movement_date": "2026-07-05", "notes": "Separado para manutenção pela regressão."},
)
expect(status, 200, "administrador envia para manutenção")
expect(moved_asset["status"], "maintenance", "manutenção muda status")
status, movements = call("GET", f"/inventory/assets/{modular_asset['id']}/movements", admin)
maintenance_movement = next((item for item in movements if item["action"] == "maintenance"), None)
if not maintenance_movement or maintenance_movement["from_status"] != "stock" or maintenance_movement["to_status"] != "maintenance":
    raise AssertionError("histórico não registrou manutenção")

status, detailed_asset = call("GET", f"/inventory/assets/{modular_asset['id']}", admin)
expect(status, 200, "detalhe segue retornando contrato novo após movimentações")
expect(detailed_asset["status"], "maintenance", "detalhe reflete última movimentação")

status, _ = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/retire",
    requester,
    {
        "reason": "DEFEITO_IRRECUPERAVEL",
        "justification": "Equipamento com placa-mãe queimada, sem viabilidade de reparo.",
        "movement_date": "2026-07-06",
    },
)
expect(status, 403, "usuário comum não dá baixa no inventário")

status, _ = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/retire",
    admin,
    {"reason": "DEFEITO_IRRECUPERAVEL", "justification": "Curta", "movement_date": "2026-07-06"},
)
expect(status, 422, "baixa exige justificativa mínima")

status, retired_asset = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/retire",
    admin,
    {
        "reason": "DEFEITO_IRRECUPERAVEL",
        "justification": "Equipamento com placa-mãe queimada, sem viabilidade de reparo.",
        "movement_date": "2026-07-06",
        "notes": "Separado pela regressão.",
    },
)
expect(status, 200, "administrador baixa equipamento")
expect(retired_asset["status"], "retired", "baixa muda status para baixado")
expect(retired_asset["retirement_reason"], "DEFEITO_IRRECUPERAVEL", "baixa persiste motivo")
expect(retired_asset["retirement_justification"], "Equipamento com placa-mãe queimada, sem viabilidade de reparo.", "baixa persiste justificativa")
assert_explicit_zone(retired_asset["retired_at"], "inventário.retired_at")

status, _ = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/retire",
    admin,
    {
        "reason": "DESCARTE",
        "justification": "Tentativa de baixa duplicada na regressão.",
        "movement_date": "2026-07-07",
    },
)
expect(status, 409, "baixa duplicada é rejeitada")

status, _ = call(
    "POST",
    f"/inventory/assets/{modular_asset['id']}/allocate",
    admin,
    {
        "sector_id": external_sector["id"],
        "assigned_user_id": requester_user["id"],
        "movement_date": "2026-07-07",
    },
)
expect(status, 409, "equipamento baixado não pode ser movimentado")

status, retired_detail = call("GET", f"/inventory/assets/{modular_asset['id']}", admin)
expect(status, 200, "consulta de equipamento baixado")
expect(retired_detail["status"], "retired", "detalhe reflete baixa")

status, retired_list = call("GET", "/inventory/assets", admin, params={"status_filter": "retired", "search": modular_asset["serial_number"]})
expect(status, 200, "listagem filtra equipamentos baixados")
if not any(item["id"] == modular_asset["id"] for item in retired_list["items"]):
    raise AssertionError("equipamento baixado não apareceu no filtro retired")

status, movements = call("GET", f"/inventory/assets/{modular_asset['id']}/movements", admin)
retired_movement = next((item for item in movements if item["action"] == "retired"), None)
if not retired_movement or retired_movement["to_status"] != "retired":
    raise AssertionError("histórico não registrou baixa")

status, roles_for_retire = call("GET", "/admin/roles", admin)
technician_role_for_retire = next(item for item in roles_for_retire if item["role"] == "technician")
status, _ = call(
    "PATCH",
    "/admin/roles/technician",
    admin,
    {"permissions": sorted(set(technician_role_for_retire["permissions"] + ["inventory.move"]))},
)
expect(status, 200, "técnico recebe inventory.move para teste de correção administrativa")
status, _ = call(
    "POST",
    f"/inventory/assets/{allocated_asset['id']}/retire",
    technician,
    {
        "reason": "CORRECAO_ADMINISTRATIVA",
        "justification": "Tentativa de correção administrativa sem perfil admin.",
        "movement_date": "2026-07-07",
    },
)
expect(status, 403, "correção administrativa restrita ao administrador")

status, legacy_inventory = call("GET", "/assets", operator)
expect(status, 200, "rota antiga de assets segue funcionando")
if not any(item["id"] == allocated_asset["id"] and item["status"] == "active" for item in legacy_inventory):
    raise AssertionError("rota antiga não preservou status active para equipamento alocado")

status, catalog = call("GET", "/catalog", requester)
expect(status, 200, "catálogo")
printer_service = next(item for item in catalog if item["name"] == "Instalar impressora")
software_service = next(item for item in catalog if item["name"] == "Instalar sistema")
general_service = next(item for item in catalog if item["name"] == "Solicitação geral")
if not printer_service["form_schema"]["fields"] or not isinstance(printer_service["form_schema"]["fields"][0], dict):
    raise AssertionError("form_schema não foi normalizado")

status, _ = call(
    "POST",
    "/tickets",
    requester,
    {
        "service_id": general_service["id"],
        "description": "Tentativa de vincular equipamento de outro usuário.",
        "asset_id": foreign_asset["id"],
        "form_data": {},
    },
)
expect(status, 403, "equipamento de outro usuário rejeitado")

status, ticket_with_modular_asset = call(
    "POST",
    "/tickets",
    requester,
    {
        "service_id": general_service["id"],
        "description": "Chamado com equipamento criado pelo contrato modular.",
        "asset_id": allocated_asset["id"],
        "form_data": {},
    },
)
expect(status, 201, "ticket.asset_id segue compatível com equipamento modular")
status, _ = call("DELETE", f"/inventory/assets/{allocated_asset['id']}", admin)
expect(status, 409, "equipamento vinculado a chamado não pode ser excluído")
status, _ = call("DELETE", f"/admin/catalog/{general_service['id']}", admin)
expect(status, 409, "serviço vinculado a chamado não pode ser excluído")
expect(ticket_with_modular_asset["asset"]["id"], allocated_asset["id"], "chamado preserva vínculo com asset modular")

# Campos administrativos continuam proibidos na abertura.
status, _ = call(
    "POST",
    "/tickets",
    requester,
    {
        "service_id": printer_service["id"],
        "description": "Tentativa com campos administrativos.",
        "title": "Título injetado",
        "priority": "critical",
        "form_data": {"local": "SEDECON"},
    },
)
expect(status, 422, "abertura rejeita título e prioridade")

# Campos obrigatórios e chaves desconhecidas são validados pelo backend.
status, _ = call(
    "POST",
    "/tickets",
    requester,
    {
        "service_id": printer_service["id"],
        "description": "Solicitação sem campo dinâmico obrigatório.",
        "form_data": {},
    },
)
expect(status, 422, "campo dinâmico obrigatório")
status, _ = call(
    "POST",
    "/tickets",
    requester,
    {
        "service_id": general_service["id"],
        "description": "Solicitação com campo adicional indevido.",
        "form_data": {"campo_inexistente": "valor"},
    },
)
expect(status, 422, "campo dinâmico desconhecido")

own_asset_id = options[0]["id"]
status, ticket = call(
    "POST",
    "/tickets",
    requester,
    {
        "service_id": printer_service["id"],
        "description": "Teste automatizado das regras do chamado.",
        "location": "SEDECON - SEGTEA",
        "asset_id": own_asset_id,
        "form_data": {
            "local": "SEDECON - SEGTEA",
            "computer": "ADSEGTEA004",
            "printer_model": "Brother DCP-L2540DW",
        },
    },
)
expect(status, 201, "abertura válida")
expect(ticket["title"], printer_service["name"], "título vem do catálogo")
expect(ticket["priority"], "medium", "prioridade inicial")
expect(ticket["service_id"], printer_service["id"], "referência histórica ao serviço")
expect(ticket["form_data"]["local"], "SEDECON - SEGTEA", "respostas estruturadas")
if not ticket["form_schema_snapshot"]["fields"]:
    raise AssertionError("schema histórico do formulário não foi preservado")
if set(ticket["asset"]) != allowed_keys:
    raise AssertionError("detalhe do solicitante expôs dados sensíveis do equipamento")
for field_name in ("created_at", "updated_at", "due_at"):
    assert_explicit_zone(ticket[field_name], f"chamado.{field_name}")

status, software_ticket = call(
    "POST",
    "/tickets",
    requester,
    {
        "service_id": software_service["id"],
        "description": "Instalação necessária para manipular arquivos do setor.",
        "form_data": {"software_name": "7-Zip", "license": "Não sei informar"},
    },
)
expect(status, 201, "criação com formulário dinâmico")
expect(software_ticket["form_data"]["software_name"], "7-Zip", "persistência de campo dinâmico")

status, _ = call("PATCH", f"/tickets/{ticket['id']}", requester, {"priority": "critical"})
expect(status, 403, "usuário não altera chamado")

status, users = call("GET", "/users", operator)
expect(status, 200, "técnico consulta responsáveis")
tech_id = next(item["id"] for item in users if item["username"] == "tecnico")

status, _ = call("PATCH", f"/tickets/{ticket['id']}", operator, {"status": "valor_invalido"})
expect(status, 422, "status inválido")
status, _ = call("PATCH", f"/tickets/{ticket['id']}", operator, {"status": "in_progress"})
expect(status, 422, "status antigo rejeitado")
status, _ = call("PATCH", f"/tickets/{ticket['id']}", operator, {"status": "closed", "resolution_message": "Atendimento concluído."})
expect(status, 409, "encerramento exige responsável")
status, updated = call(
    "PATCH",
    f"/tickets/{ticket['id']}",
    operator,
    {"status": "new", "priority": "high", "assignee_id": tech_id},
)
expect(status, 200, "triagem do técnico")
expect(updated["status"], "assigned", "atribuição promove status novo")
events = [item for item in updated["comments"] if item["event_type"] == "update"]
expect(len(events), 3, "eventos administrativos")
if not all("Maiana Ignácio" in item["body"] and not item["internal"] for item in events):
    raise AssertionError("eventos devem ter autoria e ser públicos")

status, note = call(
    "POST",
    f"/tickets/{ticket['id']}/comments",
    operator,
    {"body": "Nota interna de validação.", "internal": True},
)
expect(status, 201, "técnico cria nota interna")
assert_explicit_zone(note["created_at"], "comentário.created_at")

status, requester_view = call("GET", f"/tickets/{ticket['id']}", requester)
expect(status, 200, "usuário acompanha chamado")
expect(sum(1 for item in requester_view["comments"] if item["internal"]), 0, "notas internas filtradas")
expect(sum(1 for item in requester_view["comments"] if item["event_type"] == "update"), 3, "eventos visíveis")

status, _ = call("GET", f"/tickets/{ticket['id']}", technician)
expect(status, 200, "técnico acessa chamado atribuído")
status, _ = call("PATCH", f"/tickets/{ticket['id']}", technician, {"priority": "critical"})
expect(status, 200, "técnico altera prioridade")
status, _ = call("PATCH", f"/tickets/{ticket['id']}", technician, {"status": "closed"})
expect(status, 422, "encerramento exige mensagem")
status, closed_ticket = call(
    "PATCH",
    f"/tickets/{ticket['id']}",
    technician,
    {"status": "closed", "resolution_message": "Atendimento validado e chamado encerrado."},
)
expect(status, 200, "técnico altera status permitido")
expect(closed_ticket["status"], "closed", "chamado encerrado")
expect(any("Mensagem de encerramento" in item["body"] for item in closed_ticket["comments"]), True, "mensagem de encerramento registrada")
status, _ = call("PATCH", f"/tickets/{ticket['id']}", technician, {"status": "assigned"})
expect(status, 409, "chamado fechado não altera status")

_, page = call("GET", "/tickets", operator, params={"page_size": 100})
foreign_ticket = next(
    item for item in page["items"]
    if item.get("assignee") and item["assignee"]["id"] != tech_id
)
status, _ = call(
    "POST",
    f"/tickets/{foreign_ticket['id']}/comments",
    technician,
    {"body": "Comentário técnico de validação.", "internal": True},
)
expect(status, 201, "técnico comenta em chamado da fila")

# Cria volume suficiente para validar páginas distintas e totais agregados.
for index in range(23):
    status, _ = call(
        "POST",
        "/tickets",
        requester,
        {
            "service_id": general_service["id"],
            "description": f"Chamado de paginação número {index:02d}.",
            "form_data": {"details": f"Lote de teste {index:02d}"},
        },
    )
    expect(status, 201, f"criação para paginação {index}")

status, first_page = call("GET", "/tickets", requester, params={"page": 1, "page_size": 5})
expect(status, 200, "primeira página")
status, second_page = call("GET", "/tickets", requester, params={"page": 2, "page_size": 5})
expect(status, 200, "segunda página")
expect(first_page["page"], 1, "número da primeira página")
expect(second_page["page"], 2, "número da segunda página")
expect(first_page["page_size"], 5, "tamanho da página")
if first_page["total"] < 25:
    raise AssertionError("total paginado não considera todos os registros visíveis")
if {item["id"] for item in first_page["items"]} & {item["id"] for item in second_page["items"]}:
    raise AssertionError("páginas retornaram registros repetidos")

status, new_page = call("GET", "/tickets", requester, params={"status": "new", "page_size": 5})
expect(status, 200, "filtro paginado")
expect(new_page["summary"]["new"], new_page["total"], "resumo agregado de novos")
expect(new_page["summary"]["closed"], 0, "resumo respeita filtro de status")
if new_page["summary"]["new"] <= len(new_page["items"]):
    raise AssertionError("resumo foi calculado somente com a página carregada")

for item in first_page["items"]:
    assert_explicit_zone(item["created_at"], "lista.created_at")
    assert_explicit_zone(item["updated_at"], "lista.updated_at")

print("Regressão funcional: OK")

# Administração: permissões, usuários, catálogo, inventário e auditoria.
status, _ = call(
    "POST",
    "/admin/users",
    operator,
    {
        "username": "sempermissao",
        "full_name": "Usuário sem permissão",
        "email": "sempermissao@adcetei.cabofrio.rj.gov.br",
        "password": "SenhaTeste123",
        "role": "user",
        "secretariat": "Prefeitura de Cabo Frio",
        "department": "Teste",
        "phone": "",
        "active": True,
    },
)
expect(status, 403, "técnico não gerencia usuários")

status, created_user = call(
    "POST",
    "/admin/users",
    admin,
    {
        "username": "teste.admin",
        "full_name": "Usuário Administrativo de Teste",
        "email": "teste.admin@adcetei.cabofrio.rj.gov.br",
        "password": "SenhaTeste123",
        "role": "user",
        "secretariat": "Prefeitura de Cabo Frio",
        "department": "Validação",
        "phone": "",
        "active": True,
    },
)
expect(status, 201, "administrador cria usuário local")
status, login_result = call("POST", "/auth/login", payload={"username": "teste.admin@adcetei.cabofrio.rj.gov.br", "password": "SenhaTeste123"})
expect(status, 200, "usuário administrativo verificado autentica")
created_user_token = login_result["access_token"]
status, temporary_user = call(
    "POST",
    "/admin/users",
    admin,
    {
        "username": "recebedor.temporario",
        "full_name": "Recebedor Temporário",
        "email": "recebedor.temporario@adcetei.cabofrio.rj.gov.br",
        "password": "",
        "role": "user",
        "secretariat": "Secretaria de Governo e Integridade",
        "department_sector_id": default_sector["id"],
        "department": "ADCETEI",
        "phone": "",
        "active": False,
        "email_verified": False,
    },
)
expect(status, 201, "recebedor sem senha informada")
expect(temporary_user["active"], False, "recebedor temporário bloqueado")
expect(temporary_user["email_verified_at"], None, "recebedor temporário não verificado")
with sqlite3.connect(DB_PATH) as connection:
    temporary_hash = connection.execute("select password_hash from users where id = ?", (temporary_user["id"],)).fetchone()[0]
assert temporary_hash and not verify_password("TermoTemporario123", temporary_hash), "senha fixa não pode ser reutilizada"
status, body = call("PATCH", f"/admin/users/{temporary_user['id']}", admin, {"active": True})
expect(status, 409, "ativação sem redefinir senha")
if body.get("detail") != "Defina uma nova senha antes de ativar a conta":
    raise AssertionError("ativação sem senha deve orientar a redefinição")
status, temporary_user = call("PATCH", f"/admin/users/{temporary_user['id']}", admin, {"active": True, "password": "NovaSenhaTeste123"})
expect(status, 200, "ativação com nova senha")
expect(temporary_user["active"], True, "recebedor ativado após redefinir senha")
status, _ = call("DELETE", f"/admin/users/{temporary_user['id']}", admin)
expect(status, 200, "recebedor temporário sem histórico pode ser excluído")
status, email_changed_user = call(
    "PATCH",
    f"/admin/users/{created_user['id']}",
    admin,
    {"username": "teste.admin.renomeado", "email": "teste.admin2@adcetei.cabofrio.rj.gov.br", "email_verified": True},
)
expect(status, 200, "alteração administrativa de e-mail")
expect(email_changed_user["username"], "teste.admin.renomeado", "nome de usuário administrativo atualizado")
expect(email_changed_user["email"], "teste.admin2@adcetei.cabofrio.rj.gov.br", "e-mail administrativo atualizado")
expect(email_changed_user["email_verified_at"], None, "alteração de e-mail reseta verificação")
status, _ = call("GET", "/auth/me", created_user_token)
expect(status, 403, "token emitido antes da alteração de e-mail perde acesso")
status, created_user = call(
    "PATCH",
    f"/admin/users/{created_user['id']}",
    admin,
    {"email_verified": True},
)
expect(status, 200, "marcação administrativa explícita de e-mail verificado")
if not created_user["email_verified_at"]:
    raise AssertionError("marcação explícita não verificou o e-mail")
status, _ = call(
    "POST",
    "/admin/users",
    admin,
    {
        "username": "teste.admin.renomeado",
        "full_name": "Usuário Duplicado",
        "email": "duplicado@adcetei.cabofrio.rj.gov.br",
        "password": "SenhaTeste123",
        "role": "user",
        "secretariat": "Prefeitura de Cabo Frio",
        "department": "Validação",
        "phone": "",
        "active": True,
    },
)
expect(status, 409, "usuário duplicado rejeitado")
status, updated_user = call(
    "PATCH",
    f"/admin/users/{created_user['id']}",
    admin,
    {"role": "technician", "department": "ADCETEI", "active": False},
)
expect(status, 200, "administrador atualiza usuário")
expect(updated_user["role"], "technician", "perfil do usuário atualizado")
expect(updated_user["active"], False, "usuário bloqueado")
status, _ = call("POST", "/auth/login", payload={"username": "teste.admin2@adcetei.cabofrio.rj.gov.br", "password": "SenhaTeste123"})
expect(status, 401, "usuário bloqueado não autentica")
status, _ = call("PATCH", f"/admin/users/{admin_user['id']}", admin, {"active": False})
expect(status, 409, "administrador não desativa a própria conta")
status, _ = call("DELETE", f"/admin/users/{admin_user['id']}", admin)
expect(status, 409, "administrador não exclui a própria conta")
status, _ = call("DELETE", f"/admin/users/{created_user['id']}", admin)
expect(status, 200, "administrador exclui usuário sem histórico")

status, created_asset = call(
    "POST",
    "/admin/assets",
    admin,
    {
        "name": "NOTEBOOK-TESTE-ADM",
        "asset_type": "computer",
        "manufacturer": "Fabricante",
        "model": "Modelo",
        "serial_number": "SERIAL-ADMIN-001",
        "patrimony": "PAT-ADMIN-001",
        "status": "stock",
        "location": "Estoque ADCETEI",
        "ip_address": "",
        "operating_system": "",
        "assigned_user_id": None,
    },
)
expect(status, 201, "administrador cadastra equipamento")
status, updated_asset = call(
    "PATCH",
    f"/admin/assets/{created_asset['id']}",
    admin,
    {"status": "active", "assigned_user_id": requester_user["id"]},
)
expect(status, 200, "administrador atualiza equipamento")
expect(updated_asset["status"], "active", "status do equipamento atualizado")
status, _ = call(
    "PATCH",
    f"/admin/assets/{created_asset['id']}",
    admin,
    {"status": None},
)
expect(status, 422, "campo obrigatório nulo rejeitado")

status, catalog_options = call("GET", "/admin/catalog/options", admin)
expect(status, 200, "administrador consulta opções guiadas do catálogo")
if "Hardware" not in catalog_options["categories"] or "Impressoras" not in catalog_options["categories"]:
    raise AssertionError(f"categorias oficiais ausentes: {catalog_options['categories']}")
icon_keys = {item["key"] for item in catalog_options["icons"]}
if not {"Computer", "Printer", "Mail", "Headphones"} <= icon_keys:
    raise AssertionError(f"ícones oficiais ausentes: {icon_keys}")
field_keys = {item["key"] for item in catalog_options["fields"]}
if not {"details", "computer", "email_account", "printer_ip"} <= field_keys:
    raise AssertionError(f"campos oficiais ausentes: {field_keys}")

status, created_service = call(
    "POST",
    "/admin/catalog",
    admin,
    {
        "name": "Serviço administrativo de teste",
        "category": "Validação",
        "description": "Serviço criado pela regressão.",
        "icon": "support_agent",
        "color": "#1f5eff",
        "active": True,
        "form_schema": {
            "fields": [
                {
                    "key": "detalhes",
                    "label": "Detalhes",
                    "type": "textarea",
                    "required": True,
                    "placeholder": "Informe os detalhes",
                    "options": [],
                    "max_length": 500,
                }
            ]
        },
    },
)
expect(status, 201, "administrador cria serviço")
status, updated_service = call(
    "PATCH",
    f"/admin/catalog/{created_service['id']}",
    admin,
    {"active": False, "description": "Serviço arquivado pela regressão."},
)
expect(status, 200, "administrador atualiza serviço")
expect(updated_service["active"], False, "serviço arquivado")
status, _ = call("DELETE", f"/admin/catalog/{created_service['id']}", admin)
expect(status, 200, "administrador exclui serviço sem chamado vinculado")

status, roles = call("GET", "/admin/roles", admin)
expect(status, 200, "administrador consulta perfis")
expect({item["role"] for item in roles}, {"admin", "technician", "user"}, "perfis simplificados")
technician_role = next(item for item in roles if item["role"] == "technician")
original_permissions = technician_role["permissions"]
for permission in ("tickets.view_all", "tickets.triage", "tickets.internal_notes", "users.view", "assets.view"):
    if permission not in original_permissions:
        raise AssertionError(f"permissão operacional ausente do técnico: {permission}")
for permission in ("inventory.view",):
    if permission not in original_permissions:
        raise AssertionError(f"permissão base de inventário ausente do técnico: {permission}")
admin_role = next(item for item in roles if item["role"] == "admin")
for permission in ("inventory.view", "inventory.create", "inventory.bulk_scan", "inventory.import", "inventory.move", "inventory.edit", "inventory.manage_catalogs", "inventory.audit"):
    if permission not in admin_role["permissions"]:
        raise AssertionError(f"permissão granular de inventário ausente do admin: {permission}")
temporary_permissions = sorted(set(original_permissions + ["users.view"]))
status, changed_role = call(
    "PATCH",
    "/admin/roles/technician",
    admin,
    {"permissions": temporary_permissions},
)
expect(status, 200, "administrador altera permissões")
expect("users.view" in changed_role["permissions"], True, "permissão adicionada")
status, _ = call("GET", "/users", technician)
expect(status, 200, "permissão alterada aplicada sem novo login")
status, dependent_role = call(
    "PATCH",
    "/admin/roles/technician",
    admin,
    {"permissions": ["assets.manage"]},
)
expect(status, 200, "dependência de permissão aceita")
expect("assets.view" in dependent_role["permissions"], True, "dependência de visualização aplicada")
status, dependent_role = call(
    "PATCH",
    "/admin/roles/technician",
    admin,
    {"permissions": ["inventory.move"]},
)
expect(status, 200, "dependência de permissão granular aceita")
expect("inventory.view" in dependent_role["permissions"], True, "dependência base do inventário aplicada")
status, _ = call(
    "PATCH",
    "/admin/roles/technician",
    admin,
    {"permissions": original_permissions},
)
expect(status, 200, "perfil técnico restaurado")

status, audit = call("GET", "/admin/audit", admin, params={"limit": 100})
expect(status, 200, "administrador consulta auditoria")
audited_entities = {item["entity_type"] for item in audit}
if not {"user", "asset", "catalog", "role"} <= audited_entities:
    raise AssertionError(f"auditoria incompleta: {audited_entities}")

print("Administração e permissões: OK")
print("Regressão da API: OK")
PY
