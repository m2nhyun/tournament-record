#!/usr/bin/env bash
set -euo pipefail

source scripts/automation/source-env.sh
source scripts/automation/resolve-db-url.sh

DB_URL=$(resolve_supabase_db_url)
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/club_record_smoke.sql
