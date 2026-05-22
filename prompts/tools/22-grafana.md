# Grafana (monitoring compose)

## Purpose

Run Grafana in the CortexOS monitoring compose stack with Prometheus and Loki datasources, then import the CortexOS dashboard template.

## Prerequisites

- `20-prometheus.md` and `21-loki.md` completed.

## Install

```bash
sudo -v
sudo cp -a stacks/monitoring/. /opt/cortexos/stacks/monitoring/
cd /opt/cortexos/stacks/monitoring
set -a; . /opt/cortexos/.secrets/monitoring.env; set +a
docker compose up -d grafana
```

Datasource URLs inside the compose network:

- Prometheus: `http://prometheus:9090`
- Loki: `http://loki:3100`

Do not append `/prometheus` to the Prometheus datasource URL.

## Import CortexOS dashboard

```bash
jq -n --argjson dashboard "$(cat templates/grafana/cortex-v1.json)" '{dashboard: $dashboard, overwrite: true, folderId: 0}' \
  | curl -fsS -X POST "http://admin:${GRAFANA_ADMIN_PASSWORD}@localhost:3000/api/dashboards/import" \
      -H "Content-Type: application/json" \
      -d @-
```

## Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
curl -fsS http://localhost:3000/api/datasources/name/Prometheus/health
curl -fsS http://localhost:3000/api/datasources/name/Loki/health
```

Expected: login `200`; both datasources healthy.

## Next

→ `prompts/tools/23-fluent-bit.md`
