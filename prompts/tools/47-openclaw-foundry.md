# OpenClaw Foundry (latest)

## Purpose

Install the `0xRyanLucci/openclaw-foundry` plugin to enable template-based agent scaffolding and role provisioning directly from OpenClaw.

## Prerequisites

- `40-openclaw.md` completed.

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

- [ ] CHECKPOINT 1 confirmed — `systemctl is-active openclaw-gateway` returns active
- [ ] `git clone https://github.com/0xRyanLucci/openclaw-foundry /tmp/openclaw-foundry && npm install`
- [ ] Confirm `docs/external/openclaw-foundry.snapshot.md` exists
- [ ] `openclaw plugins install /tmp/openclaw-foundry`
- [ ] `openclaw plugins configure openclaw-foundry --templates-dir templates/openclaw/roles/`
- [ ] `sudo systemctl reload openclaw`
- [ ] Confirm `openclaw plugins list | grep foundry` shows active
- [ ] Confirm `openclaw foundry list-templates` includes `cortex.json`
- [ ] CHECKPOINT 2 confirmed — foundry plugin active
- [ ] CHECKPOINT 2b confirmed — cortex.json template listed

## CHECKPOINT 1

**STOP — operator question:** Does `systemctl is-active openclaw-gateway` print `active` (not `inactive`, not `failed`)?

Type `confirmed` to proceed.

## Install

```bash
git clone https://github.com/0xRyanLucci/openclaw-foundry /tmp/openclaw-foundry
cd /tmp/openclaw-foundry
npm install
```

Snapshot upstream README:

```bash
test -f docs/external/openclaw-foundry.snapshot.md && echo "OK" || \
  (curl -fsSL https://raw.githubusercontent.com/0xRyanLucci/openclaw-foundry/HEAD/README.md \
    > docs/external/openclaw-foundry.snapshot.md && \
   sed -i '1s/^/<!-- Snapshot of upstream openclaw-foundry at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->\n/' \
    docs/external/openclaw-foundry.snapshot.md)
```

Register:

```bash
openclaw plugins install /tmp/openclaw-foundry
```

## Configure

```bash
openclaw plugins configure openclaw-foundry \
  --templates-dir templates/openclaw/roles/
sudo systemctl reload openclaw
```

## Verify

```bash
openclaw plugins list | grep foundry
openclaw foundry list-templates
```

Expected: `openclaw-foundry` active; template list shows at least `cortex.json`.

## CHECKPOINT 2

**STOP — operator question:** Does `openclaw plugins list | grep foundry` print a line containing `active` (not `disabled`, not empty)?

Type `confirmed` to proceed.

## CHECKPOINT 2b

**STOP — operator question:** Does `openclaw foundry list-templates` output include the line `cortex.json` (not empty, not `No templates found`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/47a-cortex-sandbox.md`
