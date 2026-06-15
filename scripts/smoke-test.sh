#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PYTHON="$ROOT_DIR/apps/api/.venv/bin/python"
TEST_ROOT="$(mktemp -d)"
TEST_DB="$TEST_ROOT/smoke.db"
PORT="${SMOKE_PORT:-18020}"
API_URL="http://127.0.0.1:$PORT/api"
API_PID=""

cleanup() {
  local exit_code=$?
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$API_PID" ]] && wait "$API_PID" 2>/dev/null || true
  rm -rf "$TEST_ROOT"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

if [[ ! -x "$API_PYTHON" ]]; then
  echo "Ambiente Python não encontrado. Execute ./iniciar-local.sh uma vez."
  exit 1
fi

(
  cd "$ROOT_DIR"
  ENVIRONMENT=test \
  AUTH_MODE=email \
  SEED_DEMO_DATA=true \
  DATABASE_URL="sqlite:///$TEST_DB" \
  SECRET_KEY="chave-temporaria-do-smoke-test" \
  "$API_PYTHON" -m uvicorn apps.api.app.main:app \
    --host 127.0.0.1 --port "$PORT" --log-level warning
) >"$TEST_ROOT/api.log" 2>&1 &
API_PID=$!

for _ in {1..60}; do
  if curl -fsS "$API_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

curl -fsS "$API_URL/health" >/dev/null || {
  cat "$TEST_ROOT/api.log"
  echo "A API temporária não iniciou."
  exit 1
}

TOKEN=$(curl -fsS -X POST "$API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"servidor","password":"123456"}' | "$API_PYTHON" -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

CATALOG=$(curl -fsS "$API_URL/catalog" -H "Authorization: Bearer $TOKEN")
SERVICE_ID=$(echo "$CATALOG" | "$API_PYTHON" -c "import sys,json; data=json.load(sys.stdin); print(next(item['id'] for item in data if item['name']=='Solicitação geral'))")

TICKET=$(curl -fsS -X POST "$API_URL/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"service_id\":$SERVICE_ID,\"description\":\"Smoke test isolado de abertura de chamado.\",\"location\":\"SEDECON - SEGTEA\",\"form_data\":{\"details\":\"Validação sem alterar o banco local.\"}}")

echo "$TICKET" | "$API_PYTHON" -c "
import json, sys
ticket = json.load(sys.stdin)
assert ticket['priority'] == 'medium'
assert ticket['service_id'] == $SERVICE_ID
assert ticket['form_schema_snapshot']['fields']
print('Smoke test concluído sem alterar o banco local.')
"
