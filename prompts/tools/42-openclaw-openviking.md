# OpenClaw ↔ OpenViking Plugin (latest)

## Purpose

Install the OpenViking plugin so OpenClaw routes memory reads/writes through the
OpenViking backend.

## Prerequisites

- `40-openclaw.md` completed.
- `32-openviking.md` completed (`http://127.0.0.1:18790/health` returns OK).

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
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** OpenViking is healthy?

Type `confirmed` to proceed.

## Install

Current upstream plugin package is `@openviking/openclaw-plugin`.

```bash
npm install -g @openviking/openclaw-plugin@latest
openclaw plugins install @openviking/openclaw-plugin
```

## Configure

Use the plugin's dedicated CLI rather than the older generic plugin configure surface:

```bash
OV_KEY=$(python3 - <<'PY'
from pathlib import Path
import shlex
for line in Path('/opt/cortexos/.secrets/openviking.env').read_text().splitlines():
    if line.startswith('OPENVIKING_ROOT_API_KEY='):
        print(shlex.split(line.split('=',1)[1])[0])
        break
PY
)

openclaw openviking setup \
  --base-url http://127.0.0.1:18790 \
  --api-key "$OV_KEY" \
  --account-id cortex \
  --user-id cortex \
  --json

sudo systemctl restart openclaw-gateway
```

## Verify

```bash
openclaw openviking status
```

Expected: configured, slot active, and server reachable.

## CHECKPOINT 2

**STOP — operator question:** `openclaw openviking status` reports the plugin configured and healthy?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/43-openclaw-memory-core.md`
