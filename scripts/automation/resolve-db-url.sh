#!/usr/bin/env bash
set -euo pipefail

resolve_supabase_db_url() {
  if [[ -n "${SUPABASE_DB_PUSH_URL:-}" ]]; then
    printf '%s\n' "$SUPABASE_DB_PUSH_URL"
    return 0
  fi

  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    printf '%s\n' "$SUPABASE_DB_URL"
    return 0
  fi

  echo "[missing] SUPABASE_DB_URL"
  echo "[optional] SUPABASE_DB_PUSH_URL"
  echo "Set SUPABASE_DB_PUSH_URL to the Supabase session pooler URL when direct db.<project-ref>.supabase.co:5432 access is blocked."
  return 1
}
