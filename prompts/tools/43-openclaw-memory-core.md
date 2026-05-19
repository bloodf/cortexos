# OpenClaw Memory Core (latest)

## Purpose

Configure OpenClaw's memory-core module: enable `dream` mode for background consolidation, set retention policies, and wire up the memory graph.

## Prerequisites

- `42-openclaw-openviking.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** `openclaw memory ping` returns OK from the previous spoke?

Type `confirmed` to proceed.

## Install

```bash
npm install -g @openclaw/memory-core@latest
```

## Configure

Apply memory-core configuration from the repo template:

```bash
openclaw plugins install @openclaw/memory-core \
  --config-file templates/openclaw/config.memory-core.json
```

Enable `dream` consolidation (runs nightly at 03:00 local time):

```bash
openclaw memory dream --enable --schedule "0 3 * * *"
```

## Verify

```bash
openclaw memory status
```

Expected: shows `dream` mode enabled with next scheduled run, retention policy active.

## CHECKPOINT 2

**STOP — operator question:** `openclaw memory status` shows dream enabled and retention policy configured?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/44-openclaw-a2a-gateway.md`
