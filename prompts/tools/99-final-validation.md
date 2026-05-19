# Final Validation

## Purpose

Run a full-stack health check across every CortexOS component installed by this setup sequence. No new installs — verification only.

## Prerequisites

All prior spokes completed and their CHECKPOINT 2s confirmed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```


## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Validation Steps
- [ ] Record final state
- [ ] CHECKPOINT 2 confirmed
## CHECKPOINT 1

**STOP — operator question:** All prior spokes completed successfully and `.secrets/.setup-state.json` exists?

Type `confirmed` to proceed.
## Validation Steps

### 1. Infrastructure

```bash
# OS — Debian/Ubuntu only (see CLAUDE.md supported host OS).
sudo ufw status verbose
sudo fail2ban-client status sshd
sysctl net.ipv4.tcp_syncookies

# Docker
docker version
docker compose version

# Tailscale
tailscale status
sudo tailscale serve status

# Caddy (own state — process up, local listener, Tailscale route published)
systemctl is-active --quiet caddy && echo "caddy: active" || echo "caddy: INACTIVE"
curl -fsS -o /dev/null -w "caddy-local: %{http_code}\n" http://127.0.0.1:8080/

# Tailnet entry point (dashboard at root)
curl -sSo /dev/null -w "ts-dashboard: %{http_code}\n" "https://${CORTEX_DOMAIN}/en/login"
```

Expected: UFW active, sshd jail active, syncookies=1, Docker OK,
Tailscale online with `serve status` showing `:443 → http://localhost:8080`,
Caddy active, dashboard returns `200`.

### 2. Databases & caches

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard -c "SELECT count(*) FROM services;"
# REDIS_PASSWORD comes from /opt/cortexos/.secrets/redis.env
. /opt/cortexos/.secrets/redis.env
docker exec "$(docker compose -p redis ps -q redis)" redis-cli -a "${REDIS_PASSWORD}" ping
```

Expected: row count ≥ 0, `PONG`.

### 3. Monitoring stack

Local probes (each owned by its spoke; consolidated here):

```bash
# Prometheus — bound on 127.0.0.1:9090, served under /prometheus/
curl -fsS http://127.0.0.1:9090/prometheus/-/healthy
# Loki — bound on 127.0.0.1:3100
curl -fsS http://127.0.0.1:3100/ready
# Grafana — bound on 127.0.0.1:3000, served under /grafana/
curl -fsS -o /dev/null -w "grafana: %{http_code}\n" http://127.0.0.1:3000/grafana/login
# Node exporter — 127.0.0.1:9100
curl -fsS http://127.0.0.1:9100/metrics | grep -m1 node_cpu_seconds_total
# cAdvisor — host port 8081 (8080 is Caddy), path prefix /cadvisor
curl -fsS http://127.0.0.1:8081/cadvisor/metrics | grep -m1 container_cpu_usage_seconds_total

# Exporter target health, end-to-end via Prometheus API
curl -fsS http://127.0.0.1:9090/prometheus/api/v1/targets \
  | jq -r '.data.activeTargets[] | "\(.labels.job)\t\(.health)"'
```

Through the tailnet (Caddy path-routing):

```bash
curl -sSo /dev/null -w "prometheus: %{http_code}\n" "https://${CORTEX_DOMAIN}/prometheus/-/healthy"
curl -sSo /dev/null -w "grafana:    %{http_code}\n" "https://${CORTEX_DOMAIN}/grafana/"
curl -sSo /dev/null -w "loki:       %{http_code}\n" "https://${CORTEX_DOMAIN}/loki/ready"
curl -sSo /dev/null -w "cadvisor:   %{http_code}\n" "https://${CORTEX_DOMAIN}/cadvisor/"
```

Expected: Prometheus healthy, Loki ready, Grafana 200, all exporter
targets `up`, all tailnet routes 200/302.

Loki ingest end-to-end (proves Fluent Bit → Loki):

```bash
curl -fsS --get \
  --data-urlencode 'query={service="fluent-bit"}' \
  "http://127.0.0.1:3100/loki/api/v1/query" \
  | jq '.data.result | length'
```

Expected: `> 0`.

### 4. NATS + consumer

```bash
nats server info --server nats://127.0.0.1:4222
nats kv info cortex_approvals_seen --server nats://127.0.0.1:4222
sudo systemctl status cortex-consumer --no-pager

# NATS HTTP monitoring — owned by 30-nats.md, served via Caddy at /nats/
curl -sSo /dev/null -w "nats-varz: %{http_code}\n" "https://${CORTEX_DOMAIN}/nats/varz"
```

Expected: NATS server info shows JetStream, KV bucket present, consumer active.

### 5. AI platform

```bash
# 9Router — see 31-9router.md for the canonical port. Source the env
# rather than hardcoding a port that may drift across spokes.
. /opt/cortexos/.secrets/9router.env 2>/dev/null || true
NINEROUTER_BASE_URL="${NINEROUTER_BASE_URL:-http://localhost:11434}"
curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" "${NINEROUTER_BASE_URL}/v1/models" | jq '.data | length'

curl -fsS http://localhost:18790/health   # OpenViking
curl -fsS http://localhost:18791/health   # LEANN

# Langfuse v3 — bound on host 127.0.0.1:3001 (3000 is Grafana).
# Served via Caddy at /langfuse/. See 55-langfuse.md and 13-caddy.md.
curl -fsS -o /dev/null -w "langfuse-local: %{http_code}\n" http://127.0.0.1:3001/api/public/health
curl -sSo /dev/null -w "langfuse-tailnet: %{http_code}\n" "https://${CORTEX_DOMAIN}/langfuse/api/public/health"
```

Expected: model count ≥ 1 (9Router), OpenViking OK, LEANN OK, Langfuse OK.

### 6. OpenClaw

```bash
curl -s http://127.0.0.1:18789/health
openclaw plugins list
openclaw memory ping
```

Expected: gateway healthy, all plugins listed, memory ping OK.

### 7. AgentGateway

```bash
curl -s http://localhost:18800/health
```

Expected: health OK.

### 8. Dashboard

```bash
# Dashboard health endpoint (see packages/cortex-dashboard/src/app/api/health/route.ts)
curl -fsS http://127.0.0.1:3080/api/health | jq -r '.status'
curl -sSo /dev/null -w "%{http_code}" "https://${CORTEX_DOMAIN}/en/login"
```

Expected: `ok`, then `200`.

### 9. Paranoia checks

```bash
# Operator-local leak sweep lives in .secrets/leak-sweep.sh (pattern not stored in repo).

# No version pins in prompts
grep -rliE "@[0-9]+\.[0-9]+\.[0-9]+|sha-[0-9a-f]{7,}" /opt/cortexos/prompts/tools/ && echo "PINS FOUND — REVIEW" || echo "CLEAN"
```

Expected: both return `CLEAN`.

## Record final state

```bash
# Append completion timestamp to .secrets/.setup-state.json
python3 -c "
import json, datetime, pathlib
p = pathlib.Path('/opt/cortexos/.secrets/.setup-state.json')
state = json.loads(p.read_text()) if p.exists() else {}
state['final_validation'] = {'completed_at': datetime.datetime.utcnow().isoformat() + 'Z'}
p.write_text(json.dumps(state, indent=2))
print('State updated.')
"
```

## CHECKPOINT 2

**STOP — operator question:** All health checks returned expected values and both paranoia greps returned `CLEAN`. CortexOS v1.0 setup is complete?

**Setup complete.** All services are running. Register additional projects via the dashboard Projects page at `https://${CORTEX_DOMAIN}/en/admin/projects`.

Type `confirmed` to proceed.
