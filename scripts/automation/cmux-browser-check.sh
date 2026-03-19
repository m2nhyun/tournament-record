#!/usr/bin/env bash
set -euo pipefail

url="${CMUX_BROWSER_URL:-http://localhost:3000}"
expect_text="${CMUX_BROWSER_EXPECT_TEXT:-}"
expect_url_contains="${CMUX_BROWSER_EXPECT_URL_CONTAINS:-}"
workspace="${CMUX_BROWSER_WORKSPACE:-}"
surface="${CMUX_BROWSER_SURFACE:-}"

if ! command -v cmux >/dev/null 2>&1; then
  echo "[error] cmux command not found."
  exit 1
fi

if [[ -z "$workspace" ]]; then
  workspace="$(cmux current-workspace 2>/dev/null || true)"
fi

if [[ -z "$workspace" ]]; then
  workspace="$(cmux list-workspaces | awk 'NR==1 {print $1}')"
fi

if [[ -z "$workspace" ]]; then
  echo "[error] No cmux workspace available."
  exit 1
fi

if [[ -z "$surface" ]]; then
  surface="$(cmux tree --workspace "$workspace" | awk '/\[browser\]/ {print $3; exit}')"
fi

if [[ -z "$surface" ]]; then
  created="$(cmux new-surface --type browser --workspace "$workspace" --url "$url")"
  surface="$(printf '%s\n' "$created" | awk '{print $2}')"
else
  cmux browser --surface "$surface" goto "$url" >/dev/null
fi

if [[ -n "$expect_text" ]]; then
  cmux browser --surface "$surface" wait --text "$expect_text" >/dev/null
fi

if [[ -n "$expect_url_contains" ]]; then
  cmux browser --surface "$surface" wait --url-contains "$expect_url_contains" >/dev/null
fi

echo "[workspace] $workspace"
echo "[surface] $surface"
echo "[title] $(cmux browser --surface "$surface" get title)"
echo "[url] $(cmux browser --surface "$surface" get url)"
echo "[snapshot]"
cmux browser --surface "$surface" snapshot --compact
