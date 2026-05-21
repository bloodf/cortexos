#!/usr/bin/env bash
set -euo pipefail

ok() { printf '[ok] %s\n' "$*"; }
bad() { printf '[bad] %s\n' "$*"; }

check_http() {
  local label="$1"
  local url="$2"
  if curl -fsS --max-time 10 "$url" >/dev/null; then ok "$label"; else bad "$label"; fi
}

echo "[models]"
if [[ -n "${NINEROUTER_API_KEY:-}" ]]; then
  curl -fsS --max-time 10 -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
    "${NINEROUTER_BASE_URL:-http://127.0.0.1:11434}/v1/models" | jq -e '.data | length > 0' >/dev/null \
    && ok "9Router models available" || bad "9Router models available"
else
  bad "NINEROUTER_API_KEY set"
fi

echo "[memory]"
check_http "Honcho API" "http://127.0.0.1:18690/health"

echo "[hermes]"
check_http "Hermes primary API" "http://127.0.0.1:18691/health"
check_http "Hermes secondary API" "http://127.0.0.1:18692/health"
node scripts/paperclip-hermes-smoke.mjs >/dev/null 2>&1 && ok "Paperclip/Hermes role smoke" || bad "Paperclip/Hermes role smoke"

echo "[dashboard]"
check_http "Cortex Dashboard" "http://127.0.0.1:3080/en/login"
