# OpenClaw Codex Watchdog (latest)

## Purpose

Install the `ThisIsJeron/openclaw-codex-watchdog` plugin to block older Codex
text-only narrative-loop replies when no tool calls were made.

## Prerequisites

- `40-openclaw.md` completed.
- `30-nats.md` completed.

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

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** OpenClaw is running and NATS is reachable?

Type `confirmed` to proceed.

## Install

```bash
rm -rf /tmp/openclaw-codex-watchdog
# Version pin: shallow clone current default branch; update this prompt when pinning a commit/tag.
git clone --depth 1 https://github.com/ThisIsJeron/openclaw-codex-watchdog /tmp/openclaw-codex-watchdog
cd /tmp/openclaw-codex-watchdog
# Current upstream already ships dist/index.js + openclaw.plugin.json.
openclaw plugins install --link /tmp/openclaw-codex-watchdog || openclaw plugins install /tmp/openclaw-codex-watchdog --force
test -f docs/external/openclaw-codex-watchdog.snapshot.md && echo "OK"
```

The current plugin does not expose a runtime config schema; there is no stable
`openclaw plugins configure` step for it. If the gateway does not auto-load the
linked install, add it to the plugin allow/install metadata and restart the gateway.

## Verify

```bash
sudo systemctl restart openclaw-gateway
openclaw plugins list --enabled --verbose | grep -E 'openclaw-codex-watchdog|Codex Watchdog'
```

Expected: `openclaw-codex-watchdog` listed as active.

## CHECKPOINT 2

**STOP — operator question:** Watchdog plugin is active?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/47-openclaw-foundry.md`
