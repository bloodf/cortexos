# OpenClaw Foundry (latest)

## Purpose

Install the Foundry plugin to enable template-based agent scaffolding and role
provisioning from OpenClaw.

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

**STOP — operator question:** OpenClaw is running?

Type `confirmed` to proceed.

## Install

Current package / repo naming is inconsistent. Install from the upstream repo
and allow unsafe install because the plugin contains executable code generation
hooks.

```bash
rm -rf /tmp/openclaw-foundry
# Version pin: shallow clone current default branch; update this prompt when pinning a commit/tag.
git clone --depth 1 https://github.com/0xRyanLucci/openclaw-foundry /tmp/openclaw-foundry
cd /tmp/openclaw-foundry
npm install
openclaw plugins install /tmp/openclaw-foundry --dangerously-force-unsafe-install --force
test -f docs/external/openclaw-foundry.snapshot.md && echo "OK"
```

## Configure

Configure by patching OpenClaw config directly; the older `openclaw plugins configure`
/ `openclaw foundry list-templates` flow is not present in current runtimes.

```bash
python3 - <<'PY' >/tmp/foundry-config.json
import json
print(json.dumps({
  'plugins': {
    'entries': {
      'foundry-openclaw': {
        'enabled': True,
        'config': {
          'dataDir': '/home/cortexos/.openclaw/foundry',
          'autoLearn': True,
          'sources': {
            'docs': True,
            'experience': True,
            'arxiv': True,
            'github': True
          },
          'marketplace': {
            'autoPublish': False
          }
        }
      }
    }
  }
}, indent=2))
PY
openclaw config patch --file /tmp/foundry-config.json
sudo systemctl restart openclaw-gateway
```

## Verify

```bash
openclaw plugins list --enabled --verbose | grep -E 'foundry-openclaw|Foundry'
openclaw plugins inspect foundry-openclaw --runtime --json
```

Expected: plugin active at runtime.

## CHECKPOINT 2

**STOP — operator question:** Foundry plugin is active?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/47a-cortex-sandbox.md`
