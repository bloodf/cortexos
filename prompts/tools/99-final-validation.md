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

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — `.secrets/.setup-state.json` exists
- [ ] Run section 1 (infra: UFW, fail2ban, docker, tailscale)
- [ ] Run section 2 (psql + redis PING)
- [ ] Run section 3 (monitoring stack local + tailnet probes)
- [ ] Run section 4 (NATS + cortex-consumer)
- [ ] Run section 5 (9Router, OpenViking, LEANN, Langfuse)
- [ ] Run section 6 (OpenClaw gateway, Telegram, LAN/Tailscale Web UI, plugins)
- [ ] Run section 7 (AgentGateway /health)
- [ ] Run section 8 (Dashboard local + tailnet /en/login)
- [ ] Run section 9 (paranoia: leak sweep + version-pin grep)
- [ ] Append `final_validation` timestamp to `.setup-state.json`
- [ ] CHECKPOINT 2 confirmed — every section returned expected values

## CHECKPOINT 1

**STOP — operator question:** Does `test -s /opt/cortexos/.secrets/.setup-state.json && echo OK` print `OK` (not `No such file`, not empty)?

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

# Tailnet entry point (dashboard at root)
curl -sSo /dev/null -w "ts-dashboard: %{http_code}\n" "https://${CORTEX_DOMAIN}/en/login"
```

Expected: UFW active, sshd jail active, syncookies=1, Docker OK,
Tailscale online with `serve status` showing `:443 → http://localhost:3080`,
Tailscale Serve configured, dashboard returns `200`.

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
# Prometheus — bound on 127.0.0.1:9090
curl -fsS http://127.0.0.1:9090/-/healthy
# Loki — bound on 127.0.0.1:3100
curl -fsS http://127.0.0.1:3100/ready
# Grafana — bound on 127.0.0.1:3000
curl -fsS -o /dev/null -w "grafana: %{http_code}\n" http://127.0.0.1:3000/login
# Node exporter — 127.0.0.1:9100
curl -fsS http://127.0.0.1:9100/metrics | grep -m1 node_cpu_seconds_total
# cAdvisor — host port 8081
curl -fsS http://127.0.0.1:8081/metrics | grep -m1 container_cpu_usage_seconds_total

# Exporter target health, end-to-end via Prometheus API
curl -fsS http://127.0.0.1:9090/api/v1/targets \
  | jq -r '.data.activeTargets[] | "\(.labels.job)\t\(.health)"'
```

Through the tailnet (Tailscale Serve port routing):

```bash
curl -sSo /dev/null -w "prometheus: %{http_code}\n" "https://${CORTEX_DOMAIN}:9090/-/healthy"
curl -sSo /dev/null -w "grafana:    %{http_code}\n" "https://${CORTEX_DOMAIN}:3000/"
curl -sSo /dev/null -w "loki:       %{http_code}\n" "https://${CORTEX_DOMAIN}:3100/ready"
curl -sSo /dev/null -w "cadvisor:   %{http_code}\n" "https://${CORTEX_DOMAIN}:8081/"
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

# NATS HTTP monitoring — owned by 30-nats.md, served on tailnet port 8222
curl -sSo /dev/null -w "nats-varz: %{http_code}\n" "https://${CORTEX_DOMAIN}:8222/varz"
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
curl -fsS -o /dev/null -w "langfuse-local: %{http_code}\n" http://127.0.0.1:3001/api/public/health
curl -sSo /dev/null -w "langfuse-tailnet: %{http_code}\n" "https://${CORTEX_DOMAIN}:3001/api/public/health"
```

Expected: model count ≥ 1 (9Router), OpenViking OK, LEANN OK, Langfuse OK.

### 6. OpenClaw

```bash
curl -s http://127.0.0.1:18789/health
curl -s "https://${CORTEX_DOMAIN}:18789/health"
openclaw plugins list
openclaw models status --json | jq -r '.resolvedDefault'
openclaw channels status --deep --json | jq '.channels.telegram.running'
openclaw devices list --json | jq '.pending | length'
```

Expected: gateway healthy from loopback and Tailscale, all plugins listed,
model resolves to `9router/gpt-5.5`, Telegram running when configured, and
pending device approvals count is `0`.

For LAN Web UI validation, test each non-tailnet IPv4 address:

```bash
ip -o -4 addr show scope global | awk '$2 !~ /^tailscale/ {print $4}' \
  | cut -d/ -f1 \
  | while read -r ip; do
      curl -fsS "http://${ip}:18789/health"
    done
```

Expected: every LAN probe returns `{"ok":true,"status":"live"}`.

### 7. AgentGateway

```bash
curl -s http://localhost:18800/health
```

Expected: health OK.

### 8. Paperclip Bridge

```bash
curl -fsS http://127.0.0.1:8089/healthz
sudo journalctl -u cortex-paperclip-bridge --no-pager -n 100 | grep -F "[alerts] ready"
sudo journalctl -u cortex-paperclip-bridge --since '5 minutes ago' --no-pager | grep -F "TimeoutOverflowWarning" && echo "UNEXPECTED_TIMEOUT_OVERFLOW" || echo "no-timeout-overflow"
```

Expected: bridge health OK, alerts worker ready, and `no-timeout-overflow`.

### 9. Dashboard

```bash
curl -sSo /dev/null -w "%{http_code}" http://127.0.0.1:3080/en/login
curl -sSo /dev/null -w "%{http_code}" "https://${CORTEX_DOMAIN}/en/login"
```

Expected: `200`, then `200`.

### 10. Paranoia checks

```bash
# Operator-local leak sweep lives in .secrets/leak-sweep.sh (pattern not stored in repo).

# No version pins in prompts
grep -rliE "sha-[0-9a-f]{7,}" /opt/cortexos/prompts/tools/ && echo "UNEXPECTED SHA PINS FOUND — REVIEW" || echo "CLEAN"
```

Expected: leak sweep clean and no unexpected SHA pins. Version pins such as `leann==0.3.7` are intentional when called out by the spoke.

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

**STOP — operator question:** Did every health probe in sections 1-9 return its expected value AND did the section 9 version-pin grep print `CLEAN` (not `PINS FOUND`, not any failed curl)?

**Setup complete.** All services are running. Register additional projects via the dashboard Projects page at `https://${CORTEX_DOMAIN}/en/admin/projects`.

Type `confirmed` to proceed.
