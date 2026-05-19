# OpenClaw Codex Watchdog (latest)

## Purpose

Install the `ThisIsJeron/openclaw-codex-watchdog` plugin to monitor stale Codex worker processes and auto-restart them when they exceed idle or error thresholds.

## Prerequisites

- `40-openclaw.md` completed.
- `30-nats.md` completed (watchdog publishes alerts to NATS).

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

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed
- [ ] Known Limitations

## CHECKPOINT 1

**STOP — operator question:** OpenClaw is running and NATS is reachable?

Type `confirmed` to proceed.

## Install

```bash
git clone https://github.com/ThisIsJeron/openclaw-codex-watchdog /tmp/openclaw-codex-watchdog
cd /tmp/openclaw-codex-watchdog
npm install
```

Snapshot upstream README:

```bash
test -f docs/external/openclaw-codex-watchdog.snapshot.md && echo "OK" || \
  (curl -fsSL https://raw.githubusercontent.com/ThisIsJeron/openclaw-codex-watchdog/HEAD/README.md \
    > docs/external/openclaw-codex-watchdog.snapshot.md && \
   sed -i '1s/^/<!-- Snapshot of upstream openclaw-codex-watchdog at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->\n/' \
    docs/external/openclaw-codex-watchdog.snapshot.md)
```

Register:

```bash
openclaw plugins install /tmp/openclaw-codex-watchdog
```

## Configure

```bash
openclaw plugins configure openclaw-codex-watchdog \
  --idle-timeout 300 \
  --error-threshold 3 \
  --nats-url "nats://127.0.0.1:4222" \
  --alert-subject "cortex.alerts.watchdog"
sudo systemctl reload openclaw
```

## Verify

```bash
openclaw plugins list | grep codex-watchdog
```

Expected: `openclaw-codex-watchdog` listed as active.

## CHECKPOINT 2

**STOP — operator question:** Watchdog plugin is active?

Type `confirmed` to proceed.

## Known Limitations

### Discovery silent-skip (Phase H blocker #2)

Dropping the cloned tree into
`~/.openclaw/extensions/openclaw-codex-watchdog/` with valid
`openclaw.activation` + `openclaw.contributes` blocks is **not**
sufficient — verified absent from `openclaw plugins list` on
2026-05-16 with no diagnostic emitted. Use the
`openclaw plugins install /tmp/openclaw-codex-watchdog` step above
(requires operator gateway auth token). Re-run after every fresh clone.

## Next

→ `prompts/tools/47-openclaw-foundry.md`
