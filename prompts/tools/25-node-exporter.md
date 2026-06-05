# 25 - Node Exporter

## Purpose

Add Prometheus Node Exporter to the monitoring Docker compose stack to expose host-level metrics to Prometheus.

> **Status note:** Node Exporter is provisioned by this spoke but may not be running on the host if the monitoring stack was started without this service. Run this spoke to ensure it is included.

## Prerequisites

- `20-prometheus.md` completed — Prometheus stack running.

## CHECKPOINT 1

**STOP — operator question:** Is the monitoring stack directory present at `/opt/cortexos/stacks/monitoring`?

```bash
ls /opt/cortexos/stacks/monitoring/docker-compose.yml 2>/dev/null && echo present || echo MISSING
```

Type `confirmed` to proceed.

## Install

Copy the monitoring stack (includes the `node-exporter` service) and start only the node-exporter service:

```bash
sudo cp -a stacks/monitoring/. /opt/cortexos/stacks/monitoring/
cd /opt/cortexos/stacks/monitoring
docker compose up -d --remove-orphans node-exporter
```

Node Exporter runs with `network_mode: host` and binds `0.0.0.0:9100`. Prometheus in Docker bridge networking reaches it via `host.docker.internal:9100`.

The compose service must include:

```yaml
command:
  - '--web.listen-address=0.0.0.0:9100'
```

## Verify

```bash
curl -fsS http://127.0.0.1:9100/metrics | grep -m1 node_cpu_seconds_total
curl -fsS "http://127.0.0.1:9090/api/v1/targets" \
  | jq -r '.data.activeTargets[] | select(.labels.job=="node") | .health'
```

Expected: metric line printed; Prometheus target health is `up`.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:9100/metrics | grep node_cpu_seconds_total` return at least one metric line, and does the Prometheus targets endpoint show the `node` job as `up`?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/monitoring
docker compose stop node-exporter
docker compose rm -f node-exporter
```

## Next

→ `prompts/tools/28-db-exporters.md` (last Observability step)
