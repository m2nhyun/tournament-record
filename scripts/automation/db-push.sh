#!/usr/bin/env bash
set -euo pipefail

source scripts/automation/source-env.sh

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[missing] SUPABASE_DB_URL"
  echo "Example: postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
  exit 1
fi

DRY_RUN="${1:-}"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  npm_config_cache=.npm-cache npx supabase db push \
    --db-url "$SUPABASE_DB_URL" \
    --include-all \
    --dry-run
else
  npm_config_cache=.npm-cache npx supabase db push \
    --db-url "$SUPABASE_DB_URL" \
    --include-all \
    --yes
fi
