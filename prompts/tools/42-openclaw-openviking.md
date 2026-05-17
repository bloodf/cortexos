# OpenClaw ↔ OpenViking Plugin (latest)

## Purpose

Install the `@openclaw/openviking` plugin so OpenClaw routes all memory reads/writes through the OpenViking backend.

## Prerequisites

- `40-openclaw.md` completed.
- `32-openviking.md` completed (OpenViking running at `localhost:18790`).

## CHECKPOINT 1

Operator: confirm OpenViking is healthy (`curl -s http://localhost:18790/health`). Type "confirmed" to proceed.

## Install

```bash
npm install -g @openclaw/openviking@latest
```

Snapshot upstream README:

```bash
# Already captured as docs/external/openclaw-openviking-install.snapshot.md by 00-preflight.md
# Verify it exists:
test -f docs/external/openclaw-openviking-install.snapshot.md && echo "OK" || echo "MISSING"
```

## Configure

Register plugin with OpenClaw:

```bash
openclaw plugins install @openclaw/openviking \
  --config '{"url": "http://127.0.0.1:18790"}'
```

Reload:

```bash
sudo systemctl reload openclaw
```

## Verify

```bash
openclaw memory ping
```

Expected: `OpenViking backend: OK` (or equivalent success response from the plugin).

## CHECKPOINT 2

Operator: confirm `openclaw memory ping` returns success. Type "confirmed" to proceed.

## Next

→ `prompts/tools/43-openclaw-memory-core.md`
