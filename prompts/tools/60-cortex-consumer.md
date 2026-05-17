# Cortex Consumer (latest)

## Purpose
Deploy the `stacks/cortex-consumer/` NATS subscriber that processes approval events, forwards them to OpenClaw, and deduplicates via the `cortex_approvals_seen` JetStream KV bucket.

## Prerequisites
- `30-nats.md` completed.
- `40-openclaw.md` completed.
- `50-agentgateway.md` completed.

## CHECKPOINT 1
Operator: confirm NATS is running and the `cortex_approvals_seen` KV bucket exists (`nats kv info cortex_approvals_seen --server nats://127.0.0.1:4222`). Type "confirmed" to proceed.

## Install

Consumer code lives in the repo at `stacks/cortex-consumer/`. Deploy it:

```bash
mkdir -p /opt/cortexos/stacks/cortex-consumer
cp stacks/cortex-consumer/consumer.js /opt/cortexos/stacks/cortex-consumer/
cp stacks/cortex-consumer/config.json /opt/cortexos/stacks/cortex-consumer/
cp stacks/cortex-consumer/cortex-consumer.service /etc/systemd/system/

cd /opt/cortexos/stacks/cortex-consumer
npm install --omit=dev
```

## Configure

Edit `/opt/cortexos/stacks/cortex-consumer/config.json` for your environment:

```bash
# Set NATS URL, OpenClaw gateway URL, and AgentGateway URL
nano /opt/cortexos/stacks/cortex-consumer/config.json
# Verify: nats_url, openclaw_url, agentgateway_url fields
```

Write env:

```bash
sudo tee /opt/cortexos/.secrets/cortex-consumer.env <<EOF
NATS_URL=nats://127.0.0.1:4222
OPENCLAW_BASE=http://127.0.0.1:18789
AGENTGATEWAY_BASE=http://127.0.0.1:18800
EOF
sudo chmod 600 /opt/cortexos/.secrets/cortex-consumer.env
```

Substitute placeholders in the installed unit (template ships with `{VPS_USER}` + `{VPS_HOME}` — must be replaced before enable):

```bash
sudo sed -i "s|{VPS_USER}|$USER|g; s|{VPS_HOME}|$HOME|g" /etc/systemd/system/cortex-consumer.service
```

Enable systemd unit. Unit declares `After=network-online.target docker.service` + `Wants=network-online.target` so consumer waits for routable network AND docker before launch (NATS is docker-backed):

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-consumer
```

`enable --now` enables auto-start at boot AND starts immediately. Verify:

```bash
systemctl is-enabled cortex-consumer   # → enabled
systemctl show cortex-consumer -p After,Wants   # contains network-online.target, docker.service
```

## Verify

```bash
sudo systemctl status cortex-consumer
journalctl -u cortex-consumer --no-pager -n 20
```

Expected: service active, log shows `Connected to NATS` and `Subscribed to cortex.approvals.*`.

## CHECKPOINT 2
Operator: confirm cortex-consumer is active and subscribed to the NATS approval subject. Type "confirmed" to proceed.

## Known Limitations

### WatchdogSec intentionally absent
The shipped `stacks/cortex-consumer/cortex-consumer.service` unit does **not**
declare `WatchdogSec=`. An earlier revision set `WatchdogSec=60`, which caused
systemd to SIGABRT the process every ~60s because `consumer.js` never calls
`sd_notify("WATCHDOG=1")`. Live VPS verification on 2026-05-16:

```
$ sudo systemctl show cortex-consumer -p WatchdogUSec -p NRestarts -p MainPID
WatchdogUSec=0
NRestarts=0
MainPID=1957615   # stable across >13 minutes
```

Do not re-add `WatchdogSec=` unless you also implement sd-notify pings inside
`consumer.js` (and the underlying `nats.js` async loop). The deploy step
above patches in-place via `sed -i '/^WatchdogSec=/d'` on legacy hosts where
the older unit may still exist.

### setTimeout INT32_MAX clamp shim
`consumer.js` installs a process-level shim that caps any `setTimeout(fn, ms)`
where `ms > 2147483647` (the Node 32-bit timer ceiling) down to `INT32_MAX`.
This works around an internal timer-overflow bug in the bundled `nats.js`
client (some heartbeat intervals are advertised as months-in-ms). Removing
the shim re-introduces `TimeoutOverflowWarning` and silent reconnect stalls.
See repo commit `ca98e1c`.

### OpenClaw gateway `/sendMessage` returns 404 (Phase H blocker)
As of OpenClaw `2026.5.12`, the gateway at `:18789` does **not** expose
`/sendMessage` nor `/registerRoute`. `consumer.js` still POSTs to those
URLs and receives HTTP 404 for every outbound delivery. This is **Phase H
blocker #1**, awaiting operator decision among:

1. Build a thin adapter sidecar that translates the legacy
   `/sendMessage` shape to OpenClaw's actual RPC surface.
2. Migrate `consumer.js` to the OpenClaw RPC client directly.
3. Patch routes back in via the dashboard re-route layer.

Until resolved, smoke-test publishes succeed at the NATS layer but the
consumer's `openclaw.send()` returns 404 and no message reaches the
configured channel. See `docs/MESSAGING.md` → "Known Limitations".

## Next
→ `prompts/tools/61-smoke-tests.md`
