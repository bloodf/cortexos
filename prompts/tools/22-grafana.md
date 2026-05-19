# Grafana (latest)

## Purpose

Run Grafana as a Docker container; provision Prometheus and Loki as data sources and import the CortexOS dashboard template.

## Prerequisites

- `20-prometheus.md` and `21-loki.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Port 3000 is free?

Type `confirmed` to proceed.

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
      # Sub-path mount: Caddy serves Grafana at /grafana/ and does NOT
      # strip the prefix, so Grafana must own the prefix and emit
      # absolute URLs that include it.
      GF_SERVER_ROOT_URL: "https://${CORTEX_DOMAIN}/grafana/"
      GF_SERVER_SERVE_FROM_SUB_PATH: "true"
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
    # Prometheus runs with --web.route-prefix=/prometheus, so even
    # in-cluster the API lives under /prometheus.
    url: http://prometheus:9090/prometheus
    isDefault: true
  - name: Loki
    type: loki
    # Loki is path-agnostic in-cluster — service-to-service URL
    # does NOT carry the /loki prefix (Caddy strips it for tailnet
    # traffic only).
    url: http://loki:3100
EOF
```

Write env and start:

```bash
sudo tee /opt/cortexos/.secrets/grafana.env <<EOF
GRAFANA_ADMIN_PASSWORD={GRAFANA_ADMIN_PASSWORD}
# CORTEX_DOMAIN flows into GF_SERVER_ROOT_URL at compose-time.
CORTEX_DOMAIN=${CORTEX_DOMAIN}
EOF
sudo chmod 600 /opt/cortexos/.secrets/grafana.env

: "${CORTEX_DOMAIN:?export CORTEX_DOMAIN to your Tailscale MagicDNS FQDN}"
cd /opt/cortexos/stacks/monitoring
docker compose --env-file /opt/cortexos/.secrets/grafana.env up -d grafana
```

> Caddy forwards the `/grafana` prefix to this backend without
> stripping it. Do NOT change `GF_SERVER_SERVE_FROM_SUB_PATH` or
> `GF_SERVER_ROOT_URL` here without updating `prompts/tools/13-caddy.md`
> to match.

Import CortexOS Grafana dashboard:

```bash
# Dashboard JSON lives at templates/grafana/cortex-v1.json
curl -s -X POST http://admin:{GRAFANA_ADMIN_PASSWORD}@localhost:3000/grafana/api/dashboards/import \
  -H "Content-Type: application/json" \
  -d "{\"dashboard\": $(cat templates/grafana/cortex-v1.json), \"overwrite\": true, \"folderId\": 0}"
```

## Verify

```bash
# Local health probe (no Tailscale required) — note the /grafana prefix:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/grafana/login

# Through the tailnet:
curl -sS "https://${CORTEX_DOMAIN}/grafana/login" -o /dev/null -w "%{http_code}\n"
```

Expected: `200` on both.

## CHECKPOINT 2

**STOP — operator question:** Grafana UI loads at `https://${CORTEX_DOMAIN}/grafana/`, both datasources show green, and the CortexOS dashboard is visible?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/23-fluent-bit.md`
