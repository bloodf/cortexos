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

## CHECKPOINT 1

Operator: confirm all prior spokes completed successfully and `.secrets/.setup-state.json` exists. Type "confirmed" to proceed.

## Validation Steps

### 1. Infrastructure

```bash
# OS
if [ "$(pkg_family)" = "ubuntu" ]; then sudo ufw status verbose; else sudo firewall-cmd --list-all; fi
sudo fail2ban-client status sshd
sysctl net.ipv4.tcp_syncookies

# Docker
docker version
docker compose version

# Tailscale
tailscale status

# Caddy
curl -sSo /dev/null -w "%{http_code}" https://{DOMAIN}/en/login
```

Expected: UFW active, sshd jail active, syncookies=1, Docker OK, Tailscale online, dashboard returns 200.

### 2. Databases & caches

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard -c "SELECT count(*) FROM services;"
docker exec $(docker compose -p redis ps -q redis) redis-cli -a {REDIS_PASSWORD} ping
```

Expected: row count ≥ 0, `PONG`.

### 3. Monitoring stack

```bash
curl -s http://localhost:9090/-/healthy
curl -s http://localhost:3100/ready
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
curl -s http://localhost:9100/metrics | grep node_cpu | head -1
curl -s http://localhost:8080/metrics | grep container_cpu | head -1
```

Expected: Prometheus healthy, Loki ready, Grafana 200, node and cadvisor metrics present.

### 4. NATS + consumer

```bash
nats server info --server nats://127.0.0.1:4222
nats kv info cortex_approvals_seen --server nats://127.0.0.1:4222
sudo systemctl status cortex-consumer --no-pager
```

Expected: NATS server info shows JetStream, KV bucket present, consumer active.

### 5. AI platform

```bash
curl -s http://localhost:11434/v1/models | jq '.data | length'
curl -s http://localhost:18790/health
curl -s http://localhost:18791/health
curl -s http://localhost:3000/api/public/health
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
curl -sSo /dev/null -w "%{http_code}" https://{DOMAIN}/en/login
```

Expected: `200`.

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

Operator: confirm all health checks returned expected values and both paranoia greps returned `CLEAN`. CortexOS v1.0 setup is complete.

**Setup complete.** All services are running. Register additional projects via the dashboard Projects page at `https://{DOMAIN}/en/admin/projects`.
