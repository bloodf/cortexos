# NATS (latest)

## Purpose

Run NATS with JetStream enabled (no-auth, localhost MVP) and create the `cortex_approvals_seen` KV bucket used for approval deduplication.

> **Auth model.** Localhost MVP runs **no-auth** bound to `127.0.0.1:4222` only. Multi-account NKey hardening (see `templates/nats/accounts.conf.future`) is deferred until NATS is exposed beyond the loopback interface.

## Prerequisites

- `11-docker.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

> **NATS CLI.** Static binary release at `https://github.com/nats-io/natscli/releases/latest` works on Ubuntu and Debian — prefer it over `brew` on Linux. Pin the version inline (operator pins each run).


## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed
- [ ] Known Limitations
## CHECKPOINT 1

**STOP — operator question:** Port 4222 is free (`ss -tlnp | grep 4222`) and `nats` CLI is installed (`nats --version`)?

Type `confirmed` to proceed.
## Install

```bash
mkdir -p /opt/cortexos/stacks/nats

tee /opt/cortexos/stacks/nats/nats-server.conf <<'EOF'
# Localhost MVP: no-auth, loopback bind, JetStream enabled.
server_name: cortex-nats
listen: 127.0.0.1:4222
http: 127.0.0.1:8222

max_connections: 1024
max_payload: 1MB

jetstream {
  store_dir: /data
  max_memory_store: 256MB
  max_file_store: 4GB
}
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

**STOP — operator question:** NATS is running with JetStream and the `cortex_approvals_seen` KV bucket exists?

Type `confirmed` to proceed.
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
