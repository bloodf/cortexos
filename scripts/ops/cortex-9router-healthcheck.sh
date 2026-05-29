#!/usr/bin/env bash
# CortexOS — 9Router active health probe.
# Verifies 9Router is reachable AND can route at least one real provider call.
# On failure: restart the service. Exits 0 on healthy, 1 on probed-and-restarted.
set -euo pipefail

ENV_FILE="/opt/cortexos/.secrets/9router.env"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"
KEY="${NINEROUTER_API_KEY:-${OPENAI_API_KEY:-}}"
BASE="${NINEROUTER_BASE_URL:-http://127.0.0.1:11434}"
BASE="${BASE%/}"
PROBE_MODEL="${CORTEX_9ROUTER_PROBE_MODEL:-ollama-local/llama3.2:1b}"
LOG_TAG="cortex-9router-health"

log() { logger -t "$LOG_TAG" -- "$*"; }

# 1. Connectivity check (5s)
http_code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 \
  -H "Authorization: Bearer $KEY" "$BASE/v1/models" || echo "000")
if [[ "$http_code" != "200" ]]; then
  log "models endpoint returned HTTP $http_code — restarting 9router"
  systemctl restart 9router.service
  exit 1
fi

# 2. End-to-end probe via cheapest local model (15s) — confirms routing layer up
resp=$(curl -s -m 15 -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -X POST "$BASE/v1/chat/completions" \
  -d "{\"model\":\"$PROBE_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}],\"max_tokens\":5,\"stream\":false}" \
  || echo "")
if ! echo "$resp" | grep -q '"choices"'; then
  log "probe call against $PROBE_MODEL failed (resp=${resp:0:200}) — restarting 9router"
  systemctl restart 9router.service
  exit 1
fi

exit 0
