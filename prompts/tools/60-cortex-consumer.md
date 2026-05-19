# Cortex Consumer (latest)

## Purpose

Deploy the `stacks/cortex-consumer/` NATS subscriber that processes approval events, forwards them to OpenClaw, and deduplicates via the `cortex_approvals_seen` JetStream KV bucket.

## Prerequisites

- `30-nats.md` completed.
- `40-openclaw.md` completed.
- `50-agentgateway.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm NATS is running and the `cortex_approvals_seen` KV bucket exists (`nats kv info cortex_approvals_seen --server nats://127.0.0.1:4222`). Type "confirmed" to proceed.

## Install

Consumer code lives in the repo at `stacks/cortex-consumer/`. The runtime
needs the full directory — `consumer.js` imports from `./lib/*.js` and
the npm install step needs `package.json` + `package-lock.json` at the
target. Deploy the whole tree:

```bash
sudo mkdir -p /opt/cortexos/stacks/cortex-consumer
# `cp -a` preserves modes/symlinks; the trailing /. copies contents not
# the directory itself so re-runs converge in place.
sudo cp -a stacks/cortex-consumer/. /opt/cortexos/stacks/cortex-consumer/
sudo cp stacks/cortex-consumer/cortex-consumer.service /etc/systemd/system/

# Required tree at the target (validate before npm install):
ls /opt/cortexos/stacks/cortex-consumer/consumer.js \
   /opt/cortexos/stacks/cortex-consumer/config.json \
   /opt/cortexos/stacks/cortex-consumer/package.json \
   /opt/cortexos/stacks/cortex-consumer/package-lock.json \
   /opt/cortexos/stacks/cortex-consumer/lib

cd /opt/cortexos/stacks/cortex-consumer
sudo npm install --omit=dev
```

## Configure

Edit `/opt/cortexos/stacks/cortex-consumer/config.json` for your environment:

```bash
# Set NATS URL and OpenClaw gateway URL
nano /opt/cortexos/stacks/cortex-consumer/config.json
# Verify: nats_url, openclaw_url fields
```

Write env (canonical path `/opt/cortexos/.secrets/consumer.env` — matches
the `EnvironmentFile=` directive in the systemd unit and the path other
spokes `cat >>` into):

```bash
# Source AgentGateway bearer from its secrets file so consumer.env stays
# the single env-file pointed to by the systemd unit.
. /opt/cortexos/.secrets/agentgateway.env
sudo tee /opt/cortexos/.secrets/consumer.env <<EOF
NATS_URL=nats://127.0.0.1:4222
OPENCLAW_BASE_URL=http://127.0.0.1:18789
AGENTGATEWAY_BASE_URL=http://127.0.0.1:18800
AGENTGATEWAY_BEARER_TOKEN=${AGENTGATEWAY_BEARER_TOKEN}
EOF
sudo chmod 600 /opt/cortexos/.secrets/consumer.env
```

`consumer.js` reads `OPENCLAW_BASE_URL` (not `OPENCLAW_BASE`) at startup;
the older name is a no-op.

### AgentGateway dispatch (V13)

`consumer.js` routes paperclip work to the AgentGateway tool broker when
**all** of the following are true:

1. `AGENTGATEWAY_BASE_URL` + `AGENTGATEWAY_BEARER_TOKEN` are set in `consumer.env`.
2. The role appears in `/opt/cortexos/templates/agent-roles/.agentgateway-required.json` (written by `prompts/tools/50-agentgateway.md`).
3. The inbound paperclip payload contains a `tool_invocation` block (`{ tool, args, confirmationToken? }`).

On dispatch the consumer POSTs `{tool,args,runId,agentId,role,confirmationToken?}`
to `${AGENTGATEWAY_BASE_URL}/tool/invoke` with `Authorization: Bearer …` and a
`Nats-Msg-Id: <runId>:<tool>` header for server-side dedup. 401 → alert +
DLQ fallback; 403 → DLQ fallback; 5xx / network errors rely on JetStream
redelivery. Successful dispatches log `[agentgateway] dispatched run=… role=… tool=…`.

`kill -HUP cortex-consumer` (or `systemctl kill -s HUP cortex-consumer`)
reloads all roster files (`.agentgateway-required.json`,
`.graph-enabled.json`, `.sandbox-required.json`, `.approval-required.json`)
without restarting the process. Expect `[sighup] roster caches cleared` in
the journal.

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

## CHECKPOINT 3 — AgentGateway dispatch end-to-end

Verify the V13 wiring by publishing a paperclip work event with a
`tool_invocation` block for a role in the AgentGateway roster (default:
`ENG-BACKEND`) and confirming the consumer hands it to AgentGateway:

```bash
# Build a minimal payload — replace the HMAC + CloudEvents helpers with
# scripts/publish-paperclip-test.sh in CI; this inline form is for the
# operator-checkpoint path.
. /opt/cortexos/.secrets/agentgateway.env
. /opt/cortexos/.secrets/consumer.env || true
RUN_ID="ckpt-$(date +%s)"
ISSUE_ID="ckpt-issue"

# Watch the audit subject AgentGateway publishes on (separate terminal):
#   nats sub --count=1 'cortex.audit.agentgateway.>'

# Publish a paperclip work event (envelope construction handled by the
# test publisher; see stacks/cortex-paperclip-bridge/test-publish.sh
# for the canonical builder). Then grep the consumer journal:
journalctl -u cortex-consumer --since '60s ago' \
  | grep -E '\[agentgateway\] dispatched.*'"$RUN_ID"
```

Pass criteria:

- Consumer journal contains `[agentgateway] dispatched run=<RUN_ID> role=ENG-BACKEND tool=<name>`.
- Audit subscriber observed a single `cortex.audit.agentgateway.tool-invoke.v1` event for the run.
- No `[agentgateway] dispatch failed` lines for the run.

Failure modes:

- `[agentgateway] roster non-empty but AGENTGATEWAY_BEARER_TOKEN missing` → bearer not sourced into `consumer.env`; re-run the env-write block above.
- `agentgateway http 401` → bearer mismatch between consumer.env and agentgateway.env; rotate both from the SOPS-encrypted source.
- `agentgateway http 403` → tool not allowed for the role in `templates/agentgateway/tools.json`; expected for destructive tools missing a confirmationToken.

## Known Limitations

### WatchdogSec intentionally absent

The shipped `stacks/cortex-consumer/cortex-consumer.service` unit does **not**
declare `WatchdogSec=`. An earlier revision set `WatchdogSec=60`, which caused
systemd to SIGABRT the process every ~60s because `consumer.js` never calls
`sd_notify("WATCHDOG=1")`. Live VPS verification on 2026-05-16:

```bash
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

### OpenClaw delivery is CLI-shellout, not HTTP REST

The OpenClaw gateway at `:18789` exposes a WebSocket RPC surface, not a
REST API — legacy `/sendMessage` and `/registerRoute` HTTP routes were
never implemented upstream (404 on `2026.5.12` and later). `consumer.js`
therefore delivers via the CLI: `openclaw message send --json …` and
`openclaw agents bind …` (option #2 from the prior operator-decision
matrix). `OPENCLAW_BIN` and `OPENCLAW_CLI_TIMEOUT_MS` tune the shellout;
errors increment `openclaw_http_errors_total` and trip the circuit
breaker as before.

An experimental HTTP path is gated behind `OPENCLAW_DELIVERY_API_VERSION=v1`
(default `cli`) and targets `POST ${OPENCLAW_BASE}/v1/channels/<channel>/messages`
with bearer `OPENCLAW_API_KEY`. Off by default until the upstream REST
surface is published — see `docs/MESSAGING.md`.

## Next

→ `prompts/tools/61-smoke-tests.md`
