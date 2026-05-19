# Node Exporter (latest)

## Purpose

Run Prometheus Node Exporter as a Docker container to expose host-level metrics (CPU, memory, disk, network) to Prometheus.

## Prerequisites

- `20-prometheus.md` completed (Prometheus already scrapes `host.docker.internal:9100`).

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

**STOP — operator question:** Port 9100 is free?

Type `confirmed` to proceed.

## Install

Append Node Exporter to monitoring compose:

```bash
cat >> /opt/cortexos/stacks/monitoring/docker-compose.yml <<'EOF'

  node-exporter:
    image: prom/node-exporter
    restart: unless-stopped
    pid: host
    network_mode: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
EOF
```

```bash
cd /opt/cortexos/stacks/monitoring
docker compose up -d node-exporter
```

## Verify

```bash
curl -s http://localhost:9100/metrics | grep 'node_cpu_seconds_total' | head -3
```

Expected: metric lines printed.

Then verify Prometheus is scraping this exporter:

```bash
# Prometheus listener — try the path-prefixed form first (matches
# 20-prometheus.md --web.route-prefix=/prometheus), then fall back to
# the bare API path if needed.
curl -fsS "http://127.0.0.1:9090/prometheus/api/v1/targets" \
  | jq -r '.data.activeTargets[] | select(.labels.job=="node-exporter" or .labels.job=="node") | .health'
```

Expected: `up`.

## CHECKPOINT 2

**STOP — operator question:** Node Exporter metrics appear locally **and** the Prometheus targets API above returned `up` for `job="node-exporter"` (or `job="node"`, depending on `prometh...?

> Per [prompts/CHECKPOINT-PATTERN.md](../CHECKPOINT-PATTERN.md), this
> spoke owns the node-exporter container and the Prometheus target-up
> evidence for its own job. The Grafana dashboard view is verified in
> `99-final-validation.md`.

Type `confirmed` to proceed.

## Next

→ `prompts/tools/30-nats.md`
