#!/usr/bin/env bash
set -euo pipefail

source scripts/automation/source-env.sh
source scripts/automation/resolve-db-url.sh

DB_URL="$(resolve_supabase_db_url)"

npm_config_cache=.npm-cache npx supabase db dump \
  --db-url "$DB_URL" \
  --schema public \
  --file supabase/schema.sql

echo "[updated] supabase/schema.sql"
