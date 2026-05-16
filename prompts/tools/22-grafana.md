# Grafana (latest)

## Purpose
Run Grafana as a Docker container; provision Prometheus and Loki as data sources and import the CortexOS dashboard template.

## Prerequisites
- `20-prometheus.md` and `21-loki.md` completed.

## CHECKPOINT 1
Operator: confirm port 3000 is free. Type "confirmed" to proceed.

## Install

Append Grafana service to `/opt/cortexos/stacks/monitoring/docker-compose.yml`:

```bash
cat >> /opt/cortexos/stacks/monitoring/docker-compose.yml <<'EOF'

  grafana:
    image: grafana/grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  grafana_data:
EOF
```

Write provisioning files:

```bash
mkdir -p /opt/cortexos/stacks/monitoring/grafana/provisioning/datasources

tee /opt/cortexos/stacks/monitoring/grafana/provisioning/datasources/cortex.yml <<'EOF'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
  - name: Loki
    type: loki
    url: http://loki:3100
EOF
```

Write env and start:

```bash
sudo tee /opt/cortexos/.secrets/grafana.env <<EOF
GRAFANA_ADMIN_PASSWORD={GRAFANA_ADMIN_PASSWORD}
EOF
sudo chmod 600 /opt/cortexos/.secrets/grafana.env

cd /opt/cortexos/stacks/monitoring
docker compose --env-file /opt/cortexos/.secrets/grafana.env up -d grafana
```

Import CortexOS Grafana dashboard:
```bash
# Dashboard JSON lives at templates/grafana/cortex-v1.json
curl -s -X POST http://admin:{GRAFANA_ADMIN_PASSWORD}@localhost:3000/api/dashboards/import \
  -H "Content-Type: application/json" \
  -d "{\"dashboard\": $(cat templates/grafana/cortex-v1.json), \"overwrite\": true, \"folderId\": 0}"
```

## Verify

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
```

Expected: `200`.

## CHECKPOINT 2
Operator: confirm Grafana UI loads at `http://localhost:3000`, both datasources show green, and the CortexOS dashboard is visible. Type "confirmed" to proceed.

## Next
→ `prompts/tools/23-fluent-bit.md`
