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

- [ ] CHECKPOINT 1 confirmed — `openclaw memory ping` returns OK
- [ ] `npm install -g @openclaw/memory-core@latest`
- [ ] `openclaw plugins install @openclaw/memory-core --config-file templates/openclaw/config.memory-core.json`
- [ ] `openclaw memory dream --enable --schedule "0 3 * * *"`
- [ ] Confirm `openclaw memory status` shows dream enabled
- [ ] CHECKPOINT 2 confirmed — dream + retention active

## CHECKPOINT 1

**STOP — operator question:** Does `openclaw memory ping` print `OpenViking backend: OK` (not `connection refused`, not `error`)?

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

**STOP — operator question:** Does `openclaw memory status` show `dream: enabled` with a `next run:` timestamp (not `disabled`, not empty)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/44-openclaw-a2a-gateway.md`
