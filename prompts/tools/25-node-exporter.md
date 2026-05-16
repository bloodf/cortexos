# Node Exporter (latest)

## Purpose
Run Prometheus Node Exporter as a Docker container to expose host-level metrics (CPU, memory, disk, network) to Prometheus.

## Prerequisites
- `20-prometheus.md` completed (Prometheus already scrapes `host.docker.internal:9100`).

## CHECKPOINT 1
Operator: confirm port 9100 is free. Type "confirmed" to proceed.

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

## CHECKPOINT 2
Operator: confirm Node Exporter metrics appear and Prometheus target `node` shows `UP` at `http://localhost:9090/targets`. Type "confirmed" to proceed.

## Next
→ `prompts/tools/30-nats.md`
