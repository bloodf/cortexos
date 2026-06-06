# Loki (latest)

## Purpose

Run Grafana Loki as a Docker container to aggregate logs from Fluent Bit and make them queryable in Grafana.

## Prerequisites

- `20-prometheus.md` completed (monitoring stack compose file exists).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
if [ "$(pkg_family)" = "unknown" ]; then
    echo "WARNING: OS family not detected. Run prompts/os/00-os-selection.md first."
fi
```

## Todo

- [ ] CHECKPOINT 1 confirmed — port 3200 is free
- [ ] Write `/opt/cortexos/stacks/monitoring/loki/loki-config.yml` (filesystem storage, tsdb v13)
- [ ] Append `loki` service to monitoring `docker-compose.yml`
- [ ] `docker compose up -d loki`
- [ ] Confirm `curl http://localhost:3200/ready` prints `ready`
- [ ] CHECKPOINT 2 confirmed — both local and tailnet `/ready` probes return `ready`

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 3200` print no output (port 3200 free)?

Type `confirmed` to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/monitoring/loki
tee /opt/cortexos/stacks/monitoring/loki/loki-config.yml <<'EOF'
auth_enabled: false

server:
  http_listen_port: 3200
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
    container_name: cortex-loki
    restart: unless-stopped
    ports:
      - "127.0.0.1:3200:3100"
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

> Caddy forwards `/loki/*` to this backend and **strips** the prefix
> (Loki's HTTP API is path-agnostic). Do NOT add a `path_prefix` /
> `http_path_prefix` to Loki's config without also removing
> `uri strip_prefix /loki` in `prompts/tools/13-caddy.md`.

## Verify

```bash
# Local health probe (no Tailscale required):
curl -s http://localhost:3200/ready

# Through the tailnet (Caddy strips the /loki prefix):
curl -sS "https://${CORTEX_DOMAIN}/loki/ready"
```

Expected: `ready`.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -s http://localhost:3200/ready` print `ready` AND `curl -sS "https://${CORTEX_DOMAIN}/loki/ready"` also print `ready` (not `Ingester not ready`, not HTTP 503)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/22-grafana.md`
