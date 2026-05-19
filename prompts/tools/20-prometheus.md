# Prometheus (latest)

## Purpose

Run Prometheus as a Docker container to scrape metrics from all CortexOS exporters and services.

## Prerequisites

- `11-docker.md` completed.
- `13-caddy.md` completed (for proxied UI access).

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

**STOP — operator question:** Port 9090 is free (`ss -tlnp | grep 9090`)?

Type `confirmed` to proceed.

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
    # cAdvisor is bound to 8081 on the host (Caddy owns 8080).
    # See prompts/tools/24-cadvisor.md.
    metrics_path: /cadvisor/metrics
    static_configs:
      - targets: ["host.docker.internal:8081"]

  - job_name: prometheus
    metrics_path: /prometheus/metrics
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
      # Sub-path mount: Caddy serves Prometheus at /prometheus/ and
      # does NOT strip the prefix, so Prometheus must own the prefix
      # and emit absolute URLs that include it.
      - '--web.external-url=https://${CORTEX_DOMAIN}/prometheus/'
      - '--web.route-prefix=/prometheus'
    environment:
      CORTEX_DOMAIN: ${CORTEX_DOMAIN}
    ports:
      - "127.0.0.1:9090:9090"
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  prometheus_data:
EOF
```

Export `CORTEX_DOMAIN` (your MagicDNS FQDN from `13-caddy.md`) before
bringing the stack up — `docker compose` reads it at compose-time and
bakes it into the Prometheus `--web.external-url` flag:

```bash
: "${CORTEX_DOMAIN:?export CORTEX_DOMAIN to your Tailscale MagicDNS FQDN}"
cd /opt/cortexos/stacks/monitoring
docker compose up -d prometheus
```

> Caddy forwards the `/prometheus` prefix to this backend without
> stripping it. Do NOT change `--web.route-prefix` here without
> updating `prompts/tools/13-caddy.md` to match.

## Verify

```bash
# Local health probe (no Tailscale required):
curl -s http://localhost:9090/prometheus/-/healthy

# Through the tailnet:
curl -sS "https://${CORTEX_DOMAIN}/prometheus/-/healthy"
```

Expected: `Prometheus Server is Healthy.`

## CHECKPOINT 2

**STOP — operator question:** Prometheus is healthy at `https://${CORTEX_DOMAIN}/prometheus/` with no broken assets?

> Per [prompts/CHECKPOINT-PATTERN.md](../CHECKPOINT-PATTERN.md), the
> `cadvisor` and `node` target-UP checks are verified by `24-cadvisor.md`
> and `25-node-exporter.md` (each spoke proves its own Prometheus target)
> and again in `99-final-validation.md`. Do not block this checkpoint on
> exporters that have not been installed yet.

Type `confirmed` to proceed.

## Next

→ `prompts/tools/21-loki.md`
