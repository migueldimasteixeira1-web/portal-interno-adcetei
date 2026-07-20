#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
API_PYTHON="$API_DIR/.venv/bin/python"
SERVICES_STARTED=0

cleanup() {
  local exit_code=$?
  if [[ "$SERVICES_STARTED" -eq 1 ]]; then
    echo
    echo "Encerrando o Portal Interno ADCETEI..."
  fi
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

fail() {
  echo
  echo "ERRO: $1"
  exit 1
}

command -v python3 >/dev/null 2>&1 || fail "Python 3 não encontrado. Instale Python 3.11 ou superior."
command -v node >/dev/null 2>&1 || fail "Node.js não encontrado. Instale Node.js 20 LTS ou superior."
command -v npm >/dev/null 2>&1 || fail "npm não encontrado. Reinstale o Node.js 20 LTS."

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  fail "Node.js $(node -v) detectado. Este projeto requer Node.js 20 ou superior."
fi

echo "Ambiente detectado: Python $(python3 --version | awk '{print $2}'), Node $(node -v), npm $(npm -v)"

if [[ ! -d "$API_DIR/.venv" ]]; then
  echo "[1/5] Criando ambiente Python..."
  python3 -m venv "$API_DIR/.venv"
else
  echo "[1/5] Ambiente Python já existe."
fi

echo "[2/5] Instalando dependências da API..."
"$API_PYTHON" -m pip install --quiet --disable-pip-version-check -r "$API_DIR/requirements.txt"

echo "[3/5] Instalando dependências do frontend..."
cd "$WEB_DIR"

if [[ ! -d node_modules ]] || ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "Instalando dependências fixadas no package-lock.json..."
  rm -rf node_modules
  npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
else
  echo "Dependências do frontend já estão consistentes."
fi

cd "$ROOT_DIR"
echo "[4/5] Aplicando migrations da API..."
(cd "$API_DIR" && "$API_PYTHON" -m alembic upgrade head)

echo "[5/5] Iniciando serviços..."
(cd "$API_DIR" && "$API_PYTHON" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
API_PID=$!
(cd "$WEB_DIR" && \
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000/api}" \
  NEXT_PUBLIC_APP_ENV="${NEXT_PUBLIC_APP_ENV:-local}" \
  NEXT_PUBLIC_SHOW_DEMO_USERS="${NEXT_PUBLIC_SHOW_DEMO_USERS:-true}" \
  npm run dev) &
WEB_PID=$!
SERVICES_STARTED=1

sleep 3
echo
echo "Portal: http://localhost:3000"
echo "API:    http://localhost:8000/docs"
echo "Use Ctrl+C para encerrar."
wait
