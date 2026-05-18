# Loki (latest)

## Purpose

Run Grafana Loki as a Docker container to aggregate logs from Fluent Bit and make them queryable in Grafana.

## Prerequisites

- `20-prometheus.md` completed (monitoring stack compose file exists).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm port 3100 is free (`ss -tlnp | grep 3100`). Type "confirmed" to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/monitoring/loki
tee /opt/cortexos/stacks/monitoring/loki/loki-config.yml <<'EOF'
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 30d
EOF
```

Append Loki service to `/opt/cortexos/stacks/monitoring/docker-compose.yml`:

```bash
cat >> /opt/cortexos/stacks/monitoring/docker-compose.yml <<'EOF'

  loki:
    image: grafana/loki
    restart: unless-stopped
    ports:
      - "127.0.0.1:3100:3100"
    volumes:
      - ./loki/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml

volumes:
  loki_data:
EOF
```

```bash
cd /opt/cortexos/stacks/monitoring
docker compose up -d loki
```

## Verify

```bash
curl -s http://localhost:3100/ready
```

Expected: `ready`.

## CHECKPOINT 2

Operator: confirm Loki returns `ready`. Type "confirmed" to proceed.

## Next

→ `prompts/tools/22-grafana.md`
