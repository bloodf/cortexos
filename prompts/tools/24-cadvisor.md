# cAdvisor (latest)

## Purpose

Run cAdvisor as a Docker container to expose per-container CPU, memory, and I/O metrics for Prometheus to scrape.

## Prerequisites

- `20-prometheus.md` completed (Prometheus scrapes `host.docker.internal:8081/cadvisor/metrics`).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm port **8081** is free (`ss -tlnp | grep 8081`). cAdvisor is bound to 8081 — port 8080 is owned by Caddy (`13-caddy.md`). Type "confirmed" to proceed.

## Install

Append cAdvisor to monitoring compose:

```bash
cat >> /opt/cortexos/stacks/monitoring/docker-compose.yml <<'EOF'

  cadvisor:
    image: gcr.io/cadvisor/cadvisor
    restart: unless-stopped
    privileged: true
    # Sub-path mount: Caddy serves cAdvisor at /cadvisor/ and does NOT
    # strip the prefix, so cAdvisor must own the prefix.
    command:
      - --url_base_prefix=/cadvisor
    ports:
      # Host 8081 → container 8080. Port 8080 on the host is Caddy.
      - "127.0.0.1:8081:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker:/var/lib/docker:ro
      - /dev/disk:/dev/disk:ro
    devices:
      - /dev/kmsg
EOF
```

```bash
cd /opt/cortexos/stacks/monitoring
docker compose up -d cadvisor
```

> Caddy forwards the `/cadvisor` prefix to this backend without
> stripping it. Do NOT change `--url_base_prefix` here without
> updating `prompts/tools/13-caddy.md` to match.

## Verify

```bash
# Local smoke probe — note the /cadvisor prefix and the 8081 host port:
curl -s http://localhost:8081/cadvisor/metrics | grep 'container_cpu_usage_seconds_total' | head -3

# Through the tailnet:
curl -sS "https://${CORTEX_DOMAIN}/cadvisor/" -o /dev/null -w "cadvisor: %{http_code}\n"
```

Expected: metric lines printed; tailnet probe returns `200`/`302`.

## CHECKPOINT 2

Operator: confirm cAdvisor UI loads at `https://${CORTEX_DOMAIN}/cadvisor/` and Prometheus target `cadvisor` shows `UP` at `https://${CORTEX_DOMAIN}/prometheus/targets`. Type "confirmed" to proceed.

## Next

→ `prompts/tools/25-node-exporter.md`
