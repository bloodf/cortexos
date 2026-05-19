# OpenClaw ↔ OpenViking Plugin (latest)

## Purpose

Install the `@openclaw/openviking` plugin so OpenClaw routes all memory reads/writes through the OpenViking backend.

## Prerequisites

- `40-openclaw.md` completed.
- `32-openviking.md` completed (OpenViking running at `localhost:18790`).

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

- [ ] CHECKPOINT 1 confirmed — OpenViking `/health` returns ok
- [ ] `npm install -g @openclaw/openviking@latest`
- [ ] Verify `docs/external/openclaw-openviking-install.snapshot.md` exists
- [ ] `openclaw plugins install @openclaw/openviking --config '{"url":"http://127.0.0.1:18790"}'`
- [ ] `sudo systemctl reload openclaw`
- [ ] Confirm `openclaw memory ping` returns success
- [ ] CHECKPOINT 2 confirmed — memory ping reports OK

## CHECKPOINT 1

**STOP — operator question:** Does `curl -s http://localhost:18790/health` return `{"status":"ok"}` (not `connection refused`, not HTTP 502)?

Type `confirmed` to proceed.

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

**STOP — operator question:** Did `openclaw memory ping` print `OpenViking backend: OK` (or equivalent success) — not an error, not silence?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/43-openclaw-memory-core.md`
