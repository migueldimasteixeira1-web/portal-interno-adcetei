#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"

FILE="$BACKUP_DIR/portal-adcetei-$(date +%Y%m%d-%H%M%S).sql"
cd "$ROOT_DIR"
docker compose exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' >"$FILE"
chmod 600 "$FILE"
echo "Backup criado em: $FILE"
