# OpenClaw (latest)

## Purpose

Install OpenClaw, repair the local config schema for the current runtime, and
boot the gateway on `:18789`.

## Prerequisites

- `31-9router.md` completed.
- `32-openviking.md` completed.
- Node.js ≥ 20 installed.

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

**STOP — operator question:** Node.js ≥ 20 is installed and 9Router is running?

Type `confirmed` to proceed.

## Install

```bash
npm install -g openclaw@latest
openclaw --version
```

## Configure

Seed a minimal config, then let current OpenClaw normalize schema drift with `openclaw doctor --fix`.

```bash
set -a
source /opt/cortexos/.secrets/9router.env
set +a

mkdir -p ~/.openclaw ~/.openclaw/roles
python3 - <<'PY'
from pathlib import Path
import json, os
cfg = {
  'account': 'cortex',
  'gatewayUrl': 'http://127.0.0.1:18789',
  'aiProvider': {
    'baseUrl': 'http://127.0.0.1:11434/v1',
    'apiKey': os.environ['NINEROUTER_API_KEY'],
  },
  'memory': {
    'backend': 'openviking',
    'url': 'http://127.0.0.1:18790',
  },
  'channels': [],
}
p = Path.home()/'.openclaw/openclaw.json'
p.write_text(json.dumps(cfg, indent=2)+'\n')
p.chmod(0o600)
PY
cp templates/openclaw/roles/cortex.json ~/.openclaw/roles/cortex.json
openclaw doctor --fix || true
```

Install the gateway unit and substitute placeholders. Current runtimes are most reliable with `--allow-unconfigured` on the gateway process.

```bash
NODE_BIN=$(command -v node)
NODE_BIN_DIR=$(dirname "$NODE_BIN")
NPM_PREFIX=$(npm prefix -g)
python3 - <<PY >/tmp/openclaw-gateway.service
from pathlib import Path
s = Path('templates/systemd/openclaw-gateway.service').read_text()
s = s.replace('{VPS_USER}', 'cortexos').replace('{VPS_HOME}', '/home/cortexos').replace('{NODE_BIN}', '$NODE_BIN').replace('{NODE_BIN_DIR}', '$NODE_BIN_DIR').replace('{NPM_PREFIX}', '$NPM_PREFIX')
s = s.replace('gateway --port 18789', 'gateway --port 18789 --allow-unconfigured')
print(s, end='')
PY
cat >/tmp/openclaw-gateway.env <<EOF
NINEROUTER_BASE_URL=http://127.0.0.1:11434
NINEROUTER_API_KEY=${NINEROUTER_API_KEY}
OPENVIKING_URL=http://127.0.0.1:18790
EOF
sudo install -m 0600 -o cortexos -g cortexos /tmp/openclaw-gateway.env /opt/cortexos/.secrets/openclaw-gateway.env
sudo install -m 0644 /tmp/openclaw-gateway.service /etc/systemd/system/openclaw-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway
```

## Verify

```bash
systemctl is-enabled openclaw-gateway
systemctl show openclaw-gateway -p After,Wants
curl -fsS http://127.0.0.1:18789/health
```

Expected: gateway health OK.

## CHECKPOINT 2

**STOP — operator question:** OpenClaw gateway is healthy?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/41-openclaw-channels.md`
