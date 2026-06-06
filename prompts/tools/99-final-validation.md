# 99 - Final Validation

Run this prompt last, after all install steps are complete.

## Host Services

```bash
# All systemd units should be active
systemctl is-active caddy tailscale cortex-dashboard

# Docker stacks should be healthy
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Network

```bash
# Tailscale
 tailscale status

# Caddy reverse proxy
curl -fsS https://your-domain.com/en/login

# Dashboard health
curl -fsS http://127.0.0.1:3080/en/login
```

## Databases

```bash
# PostgreSQL
pg_isready -h 127.0.0.1 -p 5432

# Redis (if installed)
redis-cli -h 127.0.0.1 ping

# MongoDB (if installed)
mongosh --eval "db.adminCommand('ping')"
```

## Monitoring

```bash
# Prometheus
curl -fsS http://127.0.0.1:9090/prometheus/-/healthy

# Grafana (if installed)
curl -fsS http://127.0.0.1:3100/api/health
```

## AI Stack

```bash
# 9Router
curl -fsS http://127.0.0.1:11434/v1/models | jq '.data | length'

# Ollama (if installed)
curl -fsS http://127.0.0.1:11435/api/tags | jq '.models | length'
```

## CHECKPOINT 1

**STOP — operator question:** Do all host services show `active`, all Docker containers show `healthy` or `Up`, and all HTTP health checks return 200?

Type `confirmed` to proceed.

## CHECKPOINT 2

**STOP — operator question:** Can you log in to the dashboard at `https://your-domain.com/en/login`?

Type `confirmed` to proceed.

## Done

CortexOS installation is complete. Record any anomalies in `PLAN.md`.
