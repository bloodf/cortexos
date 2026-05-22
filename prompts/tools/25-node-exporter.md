# Node Exporter (monitoring compose)

## Purpose

Run Prometheus Node Exporter from the monitoring Docker compose stack and expose host metrics to Prometheus.

## Prerequisites

- `20-prometheus.md` completed.

## Install

```bash
sudo -v
sudo cp -a stacks/monitoring/. /opt/cortexos/stacks/monitoring/
cd /opt/cortexos/stacks/monitoring
docker compose up -d node-exporter
```

Node exporter runs with `network_mode: host` and must bind `all-interfaces:9100`, not `localhost:9100`; Prometheus runs in Docker bridge networking and reaches it through `host.docker.internal:9100`.

Compose command:

```yaml
- '--web.listen-address=all-interfaces:9100'
```

## Verify

```bash
curl -fsS http://localhost:9100/metrics | grep -m1 node_cpu_seconds_total
curl -fsS "http://localhost:9090/api/v1/targets" \
  | jq -r '.data.activeTargets[] | select(.labels.job=="node") | .health'
```

Expected: metric line, then `up`.

## Next

→ `prompts/tools/26-cockpit.md`
