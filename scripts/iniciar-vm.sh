#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado."
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Crie o arquivo .env a partir de .env.vm.example antes de iniciar."
  exit 1
fi
if grep -Eq 'troque-|gere-|IP-OU-DNS-DA-VM' .env; then
  echo "Substitua os valores de exemplo no arquivo .env."
  exit 1
fi

read_env() {
  sed -n "s/^$1=//p" .env | tail -1
}

SECRET_KEY="$(read_env SECRET_KEY)"
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
if (( ${#SECRET_KEY} < 32 )); then
  echo "SECRET_KEY deve ter pelo menos 32 caracteres."
  exit 1
fi
if (( ${#POSTGRES_PASSWORD} < 12 )); then
  echo "POSTGRES_PASSWORD deve ter pelo menos 12 caracteres."
  exit 1
fi
AUTH_MODE="$(read_env AUTH_MODE)"
if [[ "${AUTH_MODE:-email}" != "email" ]]; then
  echo "AUTH_MODE deve ser email."
  exit 1
fi

docker compose config --quiet
docker compose up -d --build

PORTAL_PORT="$(read_env PORTAL_PORT)"
PORTAL_PORT="${PORTAL_PORT:-80}"
HEALTH_URL="http://127.0.0.1:$PORTAL_PORT/api/health"

for _ in {1..60}; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Portal iniciado e saudável na porta $PORTAL_PORT."
    exit 0
  fi
  sleep 2
done

docker compose ps
echo "O portal não respondeu ao health check."
exit 1
