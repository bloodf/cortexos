# NATS (latest)

## Purpose

Run NATS with JetStream enabled, NKey accounts, and create the `cortex_approvals_seen` KV bucket used for approval deduplication.

## Prerequisites

- `11-docker.md` completed.
- `templates/nats/accounts.conf` present in repo.

## CHECKPOINT 1

Operator: confirm port 4222 is free (`ss -tlnp | grep 4222`) and `nats` CLI is installed (`nats --version` or install via `brew install nats-io/nats-tools/nats`). Type "confirmed" to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/nats

cp templates/nats/accounts.conf /opt/cortexos/stacks/nats/accounts.conf

tee /opt/cortexos/stacks/nats/nats-server.conf <<'EOF'
port: 4222
http_port: 8222

jetstream {
  store_dir: /data
  max_memory_store: 256MB
  max_file_store: 4GB
}

include accounts.conf
EOF

tee /opt/cortexos/stacks/nats/docker-compose.yml <<'EOF'
services:
  nats:
    image: nats
    restart: unless-stopped
    command: ["-c", "/etc/nats/nats-server.conf"]
    ports:
      - "127.0.0.1:4222:4222"
      - "127.0.0.1:8222:8222"
    volumes:
      - ./nats-server.conf:/etc/nats/nats-server.conf:ro
      - ./accounts.conf:/etc/nats/accounts.conf:ro
      - nats_data:/data

volumes:
  nats_data:
EOF

cd /opt/cortexos/stacks/nats
docker compose up -d
```

## Configure

Create JetStream KV bucket for approval deduplication:

```bash
nats kv add cortex_approvals_seen \
  --server nats://127.0.0.1:4222 \
  --ttl 24h \
  --replicas 1
```

## Verify

```bash
nats server info --server nats://127.0.0.1:4222
nats kv info cortex_approvals_seen --server nats://127.0.0.1:4222
```

Expected: server info shows JetStream enabled; KV bucket info shows `cortex_approvals_seen`.

## CHECKPOINT 2

Operator: confirm NATS is running with JetStream and the `cortex_approvals_seen` KV bucket exists. Type "confirmed" to proceed.

## Known Limitations

### `nats.js` setTimeout overflow

The bundled `nats.js` client advertises some heartbeat / reconnect timers
with values that exceed the Node 32-bit timer ceiling (`2147483647` ms),
producing `TimeoutOverflowWarning` and silent reconnect stalls. Any Node
subscriber built on `nats.js` (notably `stacks/cortex-consumer/consumer.js`,
see `60-cortex-consumer.md`) must install a process-level
`setTimeout` clamp shim that caps `ms` at `INT32_MAX` before delegating
to the original implementation. Repo reference: commit `ca98e1c`.

## Next

→ `prompts/tools/31-9router.md`
