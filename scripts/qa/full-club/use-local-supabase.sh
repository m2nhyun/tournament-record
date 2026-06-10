#!/usr/bin/env bash
# Source this file BEFORE running QA full-club commands.
# 운영 .env.local에 들어 있는 NEXT_PUBLIC_SUPABASE_URL/KEY를 로컬 supabase
# 인스턴스 값으로 강제 override한다. 운영 DB를 건드릴 위험을 막는다.
set -euo pipefail

if ! status_json="$(npx supabase status -o json 2>/dev/null)"; then
  echo "[qa] npx supabase status failed. Did you run 'npx supabase start'?" >&2
  return 1 2>/dev/null || exit 1
fi

API_URL="$(printf '%s' "$status_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["API_URL"])')"
ANON_KEY="$(printf '%s' "$status_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["ANON_KEY"])')"
SERVICE_KEY="$(printf '%s' "$status_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')"

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"

echo "[qa] using local supabase: $NEXT_PUBLIC_SUPABASE_URL"
