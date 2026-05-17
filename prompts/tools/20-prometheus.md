# Prometheus (latest)

## Purpose

Run Prometheus as a Docker container to scrape metrics from all CortexOS exporters and services.

## Prerequisites

- `11-docker.md` completed.
- `13-caddy.md` completed (for proxied UI access).

## CHECKPOINT 1

Operator: confirm port 9090 is free (`ss -tlnp | grep 9090`). Type "confirmed" to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/monitoring/prometheus
```

Write `/opt/cortexos/stacks/monitoring/prometheus/prometheus.yml`:

```bash
tee /opt/cortexos/stacks/monitoring/prometheus/prometheus.yml <<'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["host.docker.internal:9100"]

  - job_name: cadvisor
    static_configs:
      - targets: ["host.docker.internal:8080"]

  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]
EOF
```

Write `/opt/cortexos/stacks/monitoring/docker-compose.yml` (or append to existing):

```bash
mkdir -p /opt/cortexos/stacks/monitoring
tee /opt/cortexos/stacks/monitoring/docker-compose.yml <<'EOF'
services:
  prometheus:
    image: prom/prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "127.0.0.1:9090:9090"
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  prometheus_data:
EOF
```

```bash
cd /opt/cortexos/stacks/monitoring
docker compose up -d prometheus
```

## Verify

```bash
curl -s http://localhost:9090/-/healthy
```

Expected: `Prometheus Server is Healthy.`

## CHECKPOINT 2

Operator: confirm Prometheus is healthy and the UI is accessible at `http://localhost:9090` (or via Caddy proxy). Type "confirmed" to proceed.

## Next

→ `prompts/tools/21-loki.md`
