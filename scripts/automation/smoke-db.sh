#!/usr/bin/env bash
set -euo pipefail

source scripts/automation/source-env.sh
node scripts/automation/smoke-db.mjs
