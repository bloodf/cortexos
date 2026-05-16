#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
OPENCLAW_BASE="${OPENCLAW_BASE:-$HOME/.openclaw}"
NATS_URL="${NATS_URL:-nats://127.0.0.1:4222}"
PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/opt/node@24/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
DASHBOARD_DB_PASSWORD="${DASHBOARD_DB_PASSWORD:-}"
CORTEX_INTERNAL_TOKEN="${CORTEX_INTERNAL_TOKEN:-${CORTEX_MASTER_KEY:-}}"

ok() { echo "✓ $*"; PASS=$((PASS + 1)); }
bad() { echo "✗ $*"; FAIL=$((FAIL + 1)); }
check_cmd() { "$@" >/dev/null 2>&1; }

check_systemd() {
  local unit="$1" url="$2"
  check_cmd systemctl is-active --quiet "$unit" && ok "$unit active" || bad "$unit active"
  if [[ -n "$CORTEX_INTERNAL_TOKEN" && "$url" == *":3080/"* ]]; then
    check_cmd curl -fsSk --max-time 5 -H "x-cortex-internal-token: $CORTEX_INTERNAL_TOKEN" "$url" && ok "$unit health $url" || bad "$unit health $url"
  else
    check_cmd curl -fsSk --max-time 5 "$url" && ok "$unit health $url" || bad "$unit health $url"
  fi
}

check_container() {
  local name="$1" status
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || true)"
  if [[ "$status" == "healthy" || "$status" == "running" ]]; then
    ok "$name healthy"
  else
    bad "$name healthy (status=${status:-missing})"
  fi
}

check_agent() {
  local label="$1" agent="$2" prefix="$3"
  local config="$OPENCLAW_BASE/openclaw.json"
  check_cmd jq -e --arg id "$agent" '.agents.list[]? | select(.id == $id)' "$config" && ok "$label registered $agent" || bad "$label registered $agent"
  [[ -d "$OPENCLAW_BASE/agents/$agent/agent" ]] && ok "$label dir $agent" || bad "$label dir $agent"
  [[ -f "$OPENCLAW_BASE/agents/$agent/agent/CLAUDE.md" && ( -f "$OPENCLAW_BASE/agents/$agent/agent/ROLE.md" || -f "$OPENCLAW_BASE/agents/$agent/agent/WORKFLOW.md" ) ]] && ok "$label role/workflow files $agent" || bad "$label role/workflow files $agent"
  check_cmd jq -e --arg p "$prefix-" '.. | objects | select(has("prefix") and .prefix == $p)' "$config" && ok "$label OpenViking route $prefix" || bad "$label OpenViking route $prefix"
  local model
  model="$(jq -r --arg id "$agent" '.agents.list[]? | select(.id == $id) | if (.model|type) == "object" then (.model.primary // empty) else (.model // empty) end' "$config" 2>/dev/null | head -1 || true)"
  if [[ -n "$model" ]]; then
    check_cmd curl -fsS --max-time 10 http://127.0.0.1:20128/v1/models && ok "$label model endpoint reachable $model" || bad "$label model endpoint reachable $model"
  else
    bad "$label model configured $agent"
  fi
}

check_factory_workflow() {
  local agent="$1"
  local dir="$OPENCLAW_BASE/agents/$agent/agent"
  [[ -f "$dir/WORKFLOW.md" || -f "$dir/PIPELINE.md" || -f "$dir/CLAUDE.md" ]] && ok "factory workflow present $agent" || bad "factory workflow present $agent"
}

echo "[systemd services]"
if systemctl is-active --quiet cortex-dashboard.service || docker inspect cortex-dashboard --format '{{.State.Health.Status}}' 2>/dev/null | grep -q '^healthy$'; then
  ok "cortex-dashboard service/container active"
else
  bad "cortex-dashboard service/container active"
fi
check_cmd curl -fsSk --max-time 5 -H "x-cortex-internal-token: $CORTEX_INTERNAL_TOKEN" http://localhost:3080/api/system && ok "cortex-dashboard health http://localhost:3080/api/system" || bad "cortex-dashboard health http://localhost:3080/api/system"
check_systemd openclaw-gateway.service http://localhost:18789
check_systemd caddy.service https://127.0.0.1:443/
check_systemd 9router.service http://localhost:20128/api/health
check_systemd cortex-consumer.service http://localhost:3099/health

echo "[docker containers]"
for c in cortex-dashboard-db cortex-dashboard nats cortex-postgresql cortex-mysql cortex-mongodb cortex-redis cortex-grafana cortex-prometheus cortex-fluent-bit cadvisor cortex-pg-exporter cortex-mysql-exporter cortex-mongo-exporter cortex-redis-exporter openviking hindsight cortex-jellyfin home-assistant watchtower dockhand; do
  check_container "$c"
done

echo "[nats]"
check_cmd bash -c '</dev/tcp/127.0.0.1/4222' && ok "NATS reachable" || bad "NATS reachable"
if command -v nats >/dev/null 2>&1; then
  check_cmd nats --server "$NATS_URL" stream info CORTEX && ok "JetStream CORTEX stream" || bad "JetStream CORTEX stream"
  check_cmd nats --server "$NATS_URL" consumer info CORTEX cortex-consumer && ok "cortex-consumer durable" || bad "cortex-consumer durable"
else
  bad "nats CLI installed"
  bad "JetStream CORTEX stream"
  bad "cortex-consumer durable"
fi

echo "[ai platform]"
check_cmd bash -c 'curl -fsS --max-time 10 http://127.0.0.1:20128/v1/models | jq -e ".data | length > 0"' && ok "9Router models available" || bad "9Router models available"
check_cmd curl -fsS --max-time 5 http://127.0.0.1:18789 && ok "OpenClaw gateway" || bad "OpenClaw gateway"
check_cmd curl -fsS --max-time 5 http://127.0.0.1:1933/health && ok "OpenViking API" || bad "OpenViking API"
check_cmd curl -fsS --max-time 5 http://127.0.0.1:8889/health && ok "Hindsight API" || bad "Hindsight API"

echo "[agents]"
# operator adds account-specific checks here on the VPS
check_agent cortex cortex cortex
for id in $(jq -r '.agents.list[]?.id' "$OPENCLAW_BASE/openclaw.json" 2>/dev/null || true); do
  check_factory_workflow "$id"
done

echo "[dashboard db]"
if [[ -n "$DASHBOARD_DB_PASSWORD" ]]; then
  check_cmd env PGPASSWORD="$DASHBOARD_DB_PASSWORD" pg_isready -h 127.0.0.1 -U dashboard -d cortex_dashboard && ok "PostgreSQL reachable" || bad "PostgreSQL reachable"
  expected="$(find "$CORTEX_ROOT/dashboard/migrations" -maxdepth 1 -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')"
  actual="$(PGPASSWORD="$DASHBOARD_DB_PASSWORD" psql -h 127.0.0.1 -U dashboard -d cortex_dashboard -Atc 'select count(*) from migrations' 2>/dev/null || echo 0)"
  [[ "$actual" -ge "$expected" ]] && ok "migrations applied $actual/$expected" || bad "migrations applied $actual/$expected"
  count="$(PGPASSWORD="$DASHBOARD_DB_PASSWORD" psql -h 127.0.0.1 -U dashboard -d cortex_dashboard -Atc 'select count(*) from services' 2>/dev/null || echo 0)"
  [[ "$count" -gt 0 ]] && ok "services seed present" || bad "services seed present"
else
  bad "DASHBOARD_DB_PASSWORD set"
  bad "migrations applied"
  bad "services seed present"
fi

echo "PASS: $PASS  FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]]
