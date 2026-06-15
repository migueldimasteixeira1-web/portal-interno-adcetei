#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rm -f "$ROOT_DIR/apps/api/prefeitura_ti.db"
echo "Banco local apagado. Os dados de demonstração serão recriados no próximo início somente se SEED_DEMO_DATA=true."
