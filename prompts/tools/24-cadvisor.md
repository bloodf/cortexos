# cAdvisor (latest)

## Purpose

Run cAdvisor as a Docker container to expose per-container CPU, memory, and I/O metrics for Prometheus to scrape.

## Prerequisites

- `20-prometheus.md` completed (Prometheus already scrapes `host.docker.internal:8080`).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm port 8080 is free (`ss -tlnp | grep 8080`). Type "confirmed" to proceed.

## Install

Append cAdvisor to monitoring compose:

```bash
cat >> /opt/cortexos/stacks/monitoring/docker-compose.yml <<'EOF'

  cadvisor:
    image: gcr.io/cadvisor/cadvisor
    restart: unless-stopped
    privileged: true
    ports:
      - "127.0.0.1:8080:8080"
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

## Verify

```bash
curl -s http://localhost:8080/metrics | grep 'container_cpu_usage_seconds_total' | head -3
```

Expected: metric lines printed.

## CHECKPOINT 2

Operator: confirm cAdvisor metrics are visible and Prometheus target `cadvisor` shows `UP` at `http://localhost:9090/targets`. Type "confirmed" to proceed.

## Next

→ `prompts/tools/25-node-exporter.md`
