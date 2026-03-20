#!/usr/bin/env bash
set -euo pipefail

source scripts/automation/source-env.sh

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[missing] SUPABASE_DB_URL"
  echo "Example: postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
  exit 1
fi

npm_config_cache=.npm-cache npx supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --schema public \
  --file supabase/schema.sql

echo "[updated] supabase/schema.sql"
