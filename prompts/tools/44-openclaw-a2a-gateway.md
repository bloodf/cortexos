# OpenClaw A2A Gateway (latest)

## Purpose

Install the `win4r/openclaw-a2a-gateway` plugin to enable agent-to-agent (A2A) communication between OpenClaw and other AI agents over a standardized gateway protocol.

## Prerequisites

- `40-openclaw.md` completed.
- `50-agentgateway.md` will be executed after this spoke to apply tool taxonomy and rate limits.

## CHECKPOINT 1

Operator: confirm OpenClaw gateway is running (`curl -s http://127.0.0.1:18789/health`). Type "confirmed" to proceed.

## Install

```bash
git clone https://github.com/win4r/openclaw-a2a-gateway /tmp/openclaw-a2a-gateway
cd /tmp/openclaw-a2a-gateway
npm install
```

Snapshot upstream README:

```bash
# Should exist from 00-preflight.md:
test -f docs/external/openclaw-a2a-gateway.snapshot.md && echo "OK" || \
  (curl -fsSL https://raw.githubusercontent.com/win4r/openclaw-a2a-gateway/HEAD/README.md \
    > docs/external/openclaw-a2a-gateway.snapshot.md && \
   sed -i '1s/^/<!-- Snapshot of upstream openclaw-a2a-gateway at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->\n/' \
    docs/external/openclaw-a2a-gateway.snapshot.md)
```

Register with OpenClaw:

```bash
openclaw plugins install /tmp/openclaw-a2a-gateway
```

## Configure

```bash
openclaw plugins configure openclaw-a2a-gateway \
  --gateway-url "http://127.0.0.1:18789" \
  --nats-url "nats://127.0.0.1:4222"
sudo systemctl reload openclaw
```

## Verify

```bash
openclaw plugins list | grep a2a-gateway
```

Expected: `openclaw-a2a-gateway` listed as active.

## CHECKPOINT 2

Operator: confirm the A2A gateway plugin is listed as active. Type "confirmed" to proceed.

## Known Limitations

### Discovery silent-skip (Phase H blocker #2)

Dropping the cloned tree into `~/.openclaw/extensions/openclaw-a2a-gateway/`
with `openclaw.activation` + `openclaw.contributes` blocks in
`package.json` is **not** sufficient to register the plugin. Live VPS
verification on 2026-05-16 showed the manifest present but absent from
`openclaw plugins list` and from the gateway's startup plugin
enumeration. No diagnostic is emitted.

The `openclaw plugins install /tmp/openclaw-a2a-gateway` step above is
the canonical registration path and requires an operator-only gateway
auth token. Re-run after every fresh clone — manifest edits alone do
not survive a reload.

## Next

→ `prompts/tools/45-openclaw-compaction.md`
