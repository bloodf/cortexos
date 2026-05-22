# Prometheus (Docker compose)

## Purpose

Run Prometheus in the CortexOS monitoring compose stack and scrape CortexOS metrics.

## Prerequisites

- `13-tailscale-serve.md` completed.
- Exporter stacks running: node-exporter, cadvisor, pg-exporter, redis-exporter, mongo-exporter, otel-collector.

## Install

```bash
sudo -v
sudo install -d -m 0755 /opt/cortexos/stacks/monitoring/prometheus
sudo cp -a stacks/monitoring/. /opt/cortexos/stacks/monitoring/
cd /opt/cortexos/stacks/monitoring
set -a; . /opt/cortexos/.secrets/monitoring.env; set +a
docker compose up -d prometheus
```

Prometheus config: `/opt/cortexos/stacks/monitoring/prometheus/prometheus.yml`.

Scrape targets:

- `prometheus` → `localhost:9090`
- `cadvisor` → `cadvisor:8080`
- `node` → `host.docker.internal:9100`
- `pg-exporter` → `cortex-pg-exporter:9187`
- `redis-exporter` → `cortex-redis-exporter:9121`
- `mongo-exporter` → `host.docker.internal:9216`
- `otel-collector` → `cortex-otel-collector:8889`

Prometheus must be attached to `cortex-db` for pg/redis exporter DNS and `cortex-internal` for otel collector DNS.

## Reload

```bash
docker exec cortex-prometheus kill -HUP 1
```

## Verify

```bash
curl -fsS http://localhost:9090/-/healthy
curl -fsS http://localhost:9090/api/v1/targets \
  | jq '.data.activeTargets[] | {job: .labels.job, health}'
```

Expected: Prometheus healthy; every listed target `up`.

## Next

→ `prompts/tools/21-loki.md`
