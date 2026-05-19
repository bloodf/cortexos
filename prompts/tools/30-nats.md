# NATS (native)

## Purpose

Run NATS with JetStream enabled as a native systemd service and create the streams/buckets used by CortexOS.

> **Auth model.** Localhost MVP runs no-auth bound to `127.0.0.1:4222` only. Multi-account NKey hardening (see `templates/nats/accounts.conf.future`) is deferred until NATS is exposed beyond loopback.

## Prerequisites

- `09-homebrew.md` completed or direct binary install available.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — port 4222 free + `nats` CLI installed
- [ ] Install `nats-server` binary/package
- [ ] Install `/etc/nats/nats-server.conf` from `stacks/nats/config/nats-server.conf`
- [ ] Install `templates/systemd/nats.service`
- [ ] Create streams: `CORTEX_PAPERCLIP_WORK`, `CORTEX_PAPERCLIP_OPS`, `CORTEX_DLQ`, `CORTEX_AUDIT`, legacy `CORTEX`
- [ ] Create KV bucket `cortex_approvals_seen`
- [ ] Confirm JetStream enabled and streams/bucket exist
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 4222` print no output and does `nats --version` print a version string?

Type `confirmed` to proceed.

## Install

```bash
if ! command -v nats-server >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/nats-server.tar.gz" https://github.com/nats-io/nats-server/releases/download/v2.12.2/nats-server-v2.12.2-linux-amd64.tar.gz
  tar -xzf "$tmp/nats-server.tar.gz" -C "$tmp"
  sudo install -m 0755 "$tmp"/nats-server-v2.12.2-linux-amd64/nats-server /usr/local/bin/nats-server
fi

sudo useradd --system --no-create-home --shell /usr/sbin/nologin nats 2>/dev/null || true
sudo install -d -o nats -g nats -m 0755 /etc/nats /var/lib/nats/jetstream
sudo install -m 0644 stacks/nats/config/nats-server.conf /etc/nats/nats-server.conf
sudo sed -i 's|store_dir: /data/jetstream|store_dir: /var/lib/nats/jetstream|' /etc/nats/nats-server.conf
sudo install -m 0644 templates/systemd/nats.service /etc/systemd/system/nats.service
sudo systemctl daemon-reload
sudo systemctl enable --now nats
```

## Configure streams and KV

```bash
NATS_URL=nats://127.0.0.1:4222 bash stacks/nats/setup-jetstream.sh
nats kv info cortex_approvals_seen --server nats://127.0.0.1:4222 >/dev/null 2>&1 || \
  nats kv add cortex_approvals_seen --server nats://127.0.0.1:4222 --ttl 24h --replicas 1
```

## Verify

```bash
nats server info --server nats://127.0.0.1:4222
nats stream ls --server nats://127.0.0.1:4222
nats kv info cortex_approvals_seen --server nats://127.0.0.1:4222
```

Expected: JetStream enabled; streams include `CORTEX_PAPERCLIP_WORK`, `CORTEX_PAPERCLIP_OPS`, `CORTEX_DLQ`, `CORTEX_AUDIT`, and `CORTEX`; KV bucket exists.

## CHECKPOINT 2

**STOP — operator question:** Does NATS report JetStream enabled and do all required streams plus `cortex_approvals_seen` exist?

Type `confirmed` to proceed.

## Known Limitations

### `nats.js` setTimeout overflow

The bundled `nats.js` client can advertise heartbeat/reconnect timers beyond Node's 32-bit timer ceiling. Node subscribers must keep the process-level `setTimeout` clamp shim used by `stacks/cortex-consumer/consumer.js`.

## Next

→ `prompts/tools/31-9router.md`
