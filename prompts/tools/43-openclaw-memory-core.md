# OpenClaw Memory Core (latest)

## Purpose

Enable OpenClaw's bundled `memory-core` plugin, turn on nightly dreaming, and
keep active memory wired through the current runtime surfaces.

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
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** The OpenViking plugin is configured and healthy?

Type `confirmed` to proceed.

## Configure

`memory-core` is bundled in current OpenClaw releases; do not install a separate npm package. Patch the config directly:

```bash
python3 - <<'PY' >/tmp/memory-core.json
import json
print(json.dumps({
  'plugins': {
    'entries': {
      'memory-core': {
        'enabled': True,
        'config': {
          'dreaming': {
            'enabled': True,
            'frequency': '0 3 * * *',
            'timezone': 'UTC'
          }
        }
      },
      'active-memory': {
        'enabled': True,
        'config': {
          'enabled': True,
          'queryMode': 'recent',
          'promptStyle': 'balanced'
        }
      }
    },
    'slots': {
      'memory': 'memory-core'
    }
  }
}, indent=2))
PY

openclaw config patch --file /tmp/memory-core.json
sudo systemctl restart openclaw-gateway
```

## Verify

```bash
openclaw status
openclaw cron list
openclaw plugins inspect memory-core --runtime --json
```

Expected:

- `openclaw status` shows Memory enabled.
- `openclaw cron list` includes the dreaming cron.
- `memory-core` is enabled at runtime.

## CHECKPOINT 2

**STOP — operator question:** Memory is enabled, the dreaming cron exists, and `memory-core` is active?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/44-openclaw-a2a-gateway.md`
