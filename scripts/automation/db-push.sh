#!/usr/bin/env bash
set -euo pipefail

source scripts/automation/source-env.sh
source scripts/automation/resolve-db-url.sh

DB_URL="$(resolve_supabase_db_url)"

DRY_RUN="${1:-}"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  npm_config_cache=.npm-cache npx supabase db push \
    --db-url "$DB_URL" \
    --include-all \
    --dry-run
else
  npm_config_cache=.npm-cache npx supabase db push \
    --db-url "$DB_URL" \
    --include-all \
    --yes

  bash scripts/automation/db-sync-schema.sh
fi
