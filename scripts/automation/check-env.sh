#!/usr/bin/env bash
set -euo pipefail

source scripts/automation/source-env.sh

required=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
)

missing=0
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "[missing] $key"
    missing=1
  else
    echo "[ok] $key"
  fi
done

if [[ "$missing" -eq 1 ]]; then
  echo "\nRequired env vars are missing."
  exit 1
fi

echo "\nApplication env check passed."
