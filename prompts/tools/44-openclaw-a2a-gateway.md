# OpenClaw A2A Gateway (latest)

## Purpose

Install the `win4r/openclaw-a2a-gateway` plugin to enable agent-to-agent (A2A)
communication between OpenClaw and peer agents.

## Prerequisites

- `40-openclaw.md` completed.

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

**STOP — operator question:** OpenClaw gateway is healthy?

Type `confirmed` to proceed.

## Install

The upstream plugin ships TypeScript sources; transpile them before install.

```bash
rm -rf /tmp/openclaw-a2a-gateway
# Version pin: shallow clone current default branch; update this prompt when pinning a commit/tag.
git clone --depth 1 https://github.com/win4r/openclaw-a2a-gateway /tmp/openclaw-a2a-gateway
cd /tmp/openclaw-a2a-gateway
npm install
npx tsc -p tsconfig.json || npx esbuild index.ts --platform=node --format=esm --target=node20 --outfile=dist/index.js
openclaw plugins install /tmp/openclaw-a2a-gateway --force
test -f docs/external/openclaw-a2a-gateway.snapshot.md && echo "OK"
```

## Configure

Configure via config patch:

```bash
A2A_TOKEN=$(openssl rand -hex 32)
python3 - <<PY >/tmp/a2a-config.json
import json
print(json.dumps({
  'plugins': {
    'entries': {
      'a2a-gateway': {
        'enabled': True,
        'config': {
          'agentCard': {
            'name': 'CortexOS A2A Gateway',
            'description': 'A2A bridge for CortexOS OpenClaw agents',
            'url': 'http://127.0.0.1:18800/a2a/jsonrpc',
            'skills': [{'id':'chat','name':'chat','description':'Bridge chat/messages to OpenClaw agents'}]
          },
          'server': {'host': '0.0.0.0', 'port': 18800},
          'security': {'inboundAuth': 'bearer', 'token': '${A2A_TOKEN}'},
          'routing': {'defaultAgentId': 'main'}
        }
      }
    }
  }
}, indent=2))
PY
openclaw config patch --file /tmp/a2a-config.json
sudo systemctl restart openclaw-gateway
```

## Verify

```bash
openclaw plugins list --enabled --verbose | grep -E 'a2a-gateway|A2A Gateway'
```

Expected: `a2a-gateway` listed as active.

## CHECKPOINT 2

**STOP — operator question:** The A2A gateway plugin is listed as active?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/45-openclaw-compaction.md`
