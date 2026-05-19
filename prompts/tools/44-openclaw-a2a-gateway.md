# OpenClaw A2A Gateway (latest)

## Purpose

Install the `win4r/openclaw-a2a-gateway` plugin to enable agent-to-agent (A2A) communication between OpenClaw and other AI agents over a standardized gateway protocol.

## Prerequisites

- `40-openclaw.md` completed.
- `50-agentgateway.md` will be executed after this spoke to apply tool taxonomy and rate limits.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — OpenClaw gateway `/health` returns OK
- [ ] `git clone https://github.com/win4r/openclaw-a2a-gateway /tmp/openclaw-a2a-gateway && npm install`
- [ ] Confirm `docs/external/openclaw-a2a-gateway.snapshot.md` exists
- [ ] `openclaw plugins install /tmp/openclaw-a2a-gateway`
- [ ] `openclaw plugins configure openclaw-a2a-gateway --gateway-url ... --nats-url ...`
- [ ] `sudo systemctl reload openclaw`
- [ ] Confirm `openclaw plugins list | grep a2a-gateway` shows active
- [ ] CHECKPOINT 2 confirmed — plugin listed active
- [ ] Review Known Limitations (discovery silent-skip)

## CHECKPOINT 1

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:18789/health` return an OK response (not `connection refused`, not HTTP 502)?

Type `confirmed` to proceed.

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

**STOP — operator question:** Does `openclaw plugins list | grep a2a-gateway` print a line containing `active` (not `disabled`, not empty)?

Type `confirmed` to proceed.

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
