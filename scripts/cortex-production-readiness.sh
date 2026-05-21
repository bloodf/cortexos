#!/usr/bin/env bash
set -euo pipefail

failures=0
ok() { printf '[ok] %s\n' "$*"; }
bad() { printf '[bad] %s\n' "$*"; failures=$((failures + 1)); }

check_cmd() { command -v "$1" >/dev/null 2>&1 && ok "command: $1" || bad "missing command: $1"; }
check_http() {
  local label="$1" url="$2"
  curl -fsS --max-time 10 "$url" >/dev/null && ok "$label" || bad "$label"
}
check_auth_http() {
  local label="$1" url="$2" token="$3"
  curl -fsS --max-time 10 -H "Authorization: Bearer ${token}" "$url" >/dev/null && ok "$label" || bad "$label"
}
check_service_active() {
  local service="$1"
  systemctl is-active --quiet "$service" && ok "service active: $service" || bad "service inactive: $service"
}
check_cmd node
check_cmd hermes
check_cmd jq
check_cmd curl
check_cmd docker
check_cmd psql

test -f /opt/cortexos/hermes/profiles.json && ok "Hermes registry exists" || bad "Hermes registry missing"
test -f /opt/cortexos/.secrets/honcho.env && ok "Honcho env exists" || bad "Honcho env missing"
test -f /opt/cortexos/.secrets/paperclip.env && ok "Paperclip env exists" || bad "Paperclip env missing"

check_http "Honcho health" "http://127.0.0.1:18690/health"
check_http "Hermes Primary profile API health" "http://127.0.0.1:18691/health"
check_http "Hermes Secondary profile API health" "http://127.0.0.1:18692/health"
paperclip_api_url="${PAPERCLIP_API_URL:-http://127.0.0.1:3033/api}"
paperclip_api_url="${paperclip_api_url%/}"
if [[ "$paperclip_api_url" != */api ]]; then paperclip_api_url="${paperclip_api_url}/api"; fi
check_http "Paperclip API health" "${paperclip_api_url}/health"
check_http "Dashboard login" "http://127.0.0.1:3080/en/login"

check_service_active ollama.service
check_service_active ollama-honcho-embeddings-proxy.service

ollama_embed_dims="$(
  curl -fsS --max-time 20 \
    -H 'content-type: application/json' \
    -d '{"model":"nomic-embed-text:latest","input":"readiness"}' \
    http://127.0.0.1:11435/v1/embeddings \
    | jq -r '.data[0].embedding | length' 2>/dev/null || true
)"
if [[ "$ollama_embed_dims" == "768" ]]; then
  ok "Ollama Vulkan embedding model returns 768 dimensions"
else
  bad "Ollama Vulkan embedding model did not return 768 dimensions"
fi

honcho_container_embed_dims="$(
  cd /opt/cortexos/stacks/honcho
  docker compose exec -T api /app/.venv/bin/python - <<'PY' 2>/dev/null || true
import json
import urllib.request

req = urllib.request.Request(
    "http://172.30.0.1:11435/v1/embeddings",
    data=json.dumps({"model": "nomic-embed-text:latest", "input": "readiness"}).encode(),
    headers={"content-type": "application/json"},
)
data = json.loads(urllib.request.urlopen(req, timeout=20).read())
print(len(data["data"][0]["embedding"]))
PY
)"
if [[ "$honcho_container_embed_dims" == "768" ]]; then
  ok "Honcho container can reach Ollama proxy with 768 dimensions"
else
  bad "Honcho container cannot reach Ollama proxy with 768 dimensions"
fi

honcho_router_chat="$(
  cd /opt/cortexos/stacks/honcho
  docker compose exec -T api /app/.venv/bin/python - <<'PY' 2>/dev/null || true
import json
import os
import urllib.request

req = urllib.request.Request(
    "http://172.17.0.1:11434/v1/chat/completions",
    data=json.dumps({
        "model": "cx/gpt-5.5",
        "messages": [{"role": "user", "content": "Return ok."}],
        "max_tokens": 20,
    }).encode(),
    headers={
        "content-type": "application/json",
        "authorization": f"Bearer {os.environ['LLM_OPENAI_API_KEY']}",
    },
)
data = json.loads(urllib.request.urlopen(req, timeout=45).read())
print(data["choices"][0]["message"].get("content", "").strip())
PY
)"
if [[ -n "$honcho_router_chat" ]]; then
  ok "Honcho container can reach 9Router chat model"
else
  bad "Honcho container cannot reach 9Router chat model"
fi

honcho_deriver_count="$(
  cd /opt/cortexos/stacks/honcho
  docker compose ps --services --filter status=running 2>/dev/null | awk '$0 == "deriver" {n++} END {print n+0}'
)"
if (( honcho_deriver_count > 0 )); then
  ok "Honcho deriver is running"
else
  bad "Honcho deriver is not running"
fi

honcho_llm_config_missing="$(
  cd /opt/cortexos/stacks/honcho
  docker compose exec -T api env 2>/dev/null \
    | awk -F= '
      /^(DERIVER_MODEL_CONFIG|SUMMARY_MODEL_CONFIG|DIALECTIC_LEVELS__minimal__MODEL_CONFIG|DIALECTIC_LEVELS__low__MODEL_CONFIG|DIALECTIC_LEVELS__medium__MODEL_CONFIG|DIALECTIC_LEVELS__high__MODEL_CONFIG|DIALECTIC_LEVELS__max__MODEL_CONFIG|DREAM_DEDUCTION_MODEL_CONFIG|DREAM_INDUCTION_MODEL_CONFIG)__OVERRIDES__BASE_URL=/ {
        seen[$1]=1
        if ($2 != "http://172.17.0.1:11434/v1") bad[$1]=$2
      }
      END {
        required[1]="DERIVER_MODEL_CONFIG__OVERRIDES__BASE_URL"
        required[2]="SUMMARY_MODEL_CONFIG__OVERRIDES__BASE_URL"
        required[3]="DIALECTIC_LEVELS__minimal__MODEL_CONFIG__OVERRIDES__BASE_URL"
        required[4]="DIALECTIC_LEVELS__low__MODEL_CONFIG__OVERRIDES__BASE_URL"
        required[5]="DIALECTIC_LEVELS__medium__MODEL_CONFIG__OVERRIDES__BASE_URL"
        required[6]="DIALECTIC_LEVELS__high__MODEL_CONFIG__OVERRIDES__BASE_URL"
        required[7]="DIALECTIC_LEVELS__max__MODEL_CONFIG__OVERRIDES__BASE_URL"
        required[8]="DREAM_DEDUCTION_MODEL_CONFIG__OVERRIDES__BASE_URL"
        required[9]="DREAM_INDUCTION_MODEL_CONFIG__OVERRIDES__BASE_URL"
        for (i=1; i<=9; i++) if (!seen[required[i]]) print required[i] ":missing"
        for (name in bad) print name ":" bad[name]
      }
    '
)"
if [[ -z "$honcho_llm_config_missing" ]]; then
  ok "Honcho text-generation features route through 9Router"
else
  bad "Honcho text-generation feature routing incomplete: $honcho_llm_config_missing"
fi

honcho_db_embed_dims="$(
  cd /opt/cortexos/stacks/honcho
  docker compose exec -T database psql -U postgres -d postgres -tAc "select coalesce(max(vector_dims(embedding)), 0) from message_embeddings where embedding is not null;" 2>/dev/null | tr -d '[:space:]' || true
)"
if [[ "$honcho_db_embed_dims" == "768" ]]; then
  ok "Honcho pgvector embeddings are 768 dimensions"
else
  bad "Honcho pgvector embeddings are not 768 dimensions"
fi

if [[ -n "${NINEROUTER_API_KEY:-}" ]]; then
  base="${NINEROUTER_BASE_URL:-http://127.0.0.1:11434}"
  base="${base%/}"
  if [[ "$base" == */v1 ]]; then models_url="${base}/models"; else models_url="${base}/v1/models"; fi
  check_auth_http "9Router models" "$models_url" "$NINEROUTER_API_KEY"
else
  bad "NINEROUTER_API_KEY not loaded"
fi

node scripts/sync-hermes-9router-profiles.mjs >/dev/null && ok "Hermes profile models available in 9Router" || bad "Hermes profile models missing in 9Router"
node scripts/paperclip-hermes-smoke.mjs >/dev/null && ok "Paperclip/Hermes registration smoke" || bad "Paperclip/Hermes registration smoke"
if [[ "${CORTEX_FULL_PIPELINE_SMOKE:-0}" == "1" ]]; then
  node scripts/cortex-full-pipeline-smoke.mjs >/dev/null && ok "Full factory/Paperclip/Hermes/Honcho pipeline smoke" || bad "Full factory/Paperclip/Hermes/Honcho pipeline smoke"
else
  ok "Full factory/Paperclip/Hermes/Honcho pipeline smoke skipped (set CORTEX_FULL_PIPELINE_SMOKE=1)"
fi

test -x /home/cortexos/.local/bin/hermes && ok "Paperclip Hermes command exists" || bad "Paperclip Hermes command missing"
import_count=$(find /opt/cortexos/backups/memory-import-pending -maxdepth 1 -type f -name '*-legacy-profile-import.jsonl' 2>/dev/null | wc -l | tr -d '[:space:]')
if (( import_count > 0 )); then
  ok "Honcho import artifacts exist"
else
  ok "Honcho import artifacts skipped (none present)"
fi

if [[ -n "${CORTEX_DOMAIN:-}" && -n "${HONCHO_API_KEY:-}" ]]; then
  check_auth_http "Tailnet Honcho API" "https://${CORTEX_DOMAIN}:18690/health" "$HONCHO_API_KEY"
else
  ok "Tailnet Honcho API skipped (CORTEX_DOMAIN or HONCHO_API_KEY not loaded)"
fi

if (( failures > 0 )); then
  printf '[readiness] failed checks: %d\n' "$failures" >&2
  exit 1
fi

printf '[readiness] production checks passed\n'
