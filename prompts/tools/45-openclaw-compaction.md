# OpenClaw Compaction Context (latest)

## Purpose

Install the `robertcuadra/compaction-context` plugin to enable automatic context window compaction for long-running OpenClaw agent sessions.

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
- [ ] `git clone https://github.com/robertcuadra/compaction-context /tmp/compaction-context && npm install`
- [ ] Confirm `docs/external/openclaw-compaction-context.snapshot.md` exists
- [ ] `openclaw plugins install /tmp/compaction-context`
- [ ] `openclaw plugins configure compaction-context --threshold 0.80 --strategy summarize`
- [ ] `sudo systemctl reload openclaw`
- [ ] Confirm `openclaw plugins list | grep compaction-context` shows active
- [ ] CHECKPOINT 2 confirmed — plugin listed active
- [ ] Review Known Limitations (discovery silent-skip)

## CHECKPOINT 1

**STOP — operator question:** Does `systemctl is-active openclaw-gateway` print `active` (not `inactive`, not `failed`)?

Type `confirmed` to proceed.

## Install

```bash
git clone https://github.com/robertcuadra/compaction-context /tmp/compaction-context
cd /tmp/compaction-context
npm install
```

Snapshot upstream README:

```bash
test -f docs/external/openclaw-compaction-context.snapshot.md && echo "OK" || \
  (curl -fsSL https://raw.githubusercontent.com/robertcuadra/compaction-context/HEAD/README.md \
    > docs/external/openclaw-compaction-context.snapshot.md && \
   sed -i '1s/^/<!-- Snapshot of upstream compaction-context at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->\n/' \
    docs/external/openclaw-compaction-context.snapshot.md)
```

Register:

```bash
openclaw plugins install /tmp/compaction-context
```

## Configure

```bash
openclaw plugins configure compaction-context \
  --threshold 0.80 \
  --strategy summarize
sudo systemctl reload openclaw
```

`--threshold 0.80` triggers compaction at 80% context fill.

## Verify

```bash
openclaw plugins list | grep compaction-context
```

Expected: `compaction-context` listed as active.

## CHECKPOINT 2

**STOP — operator question:** Does `openclaw plugins list | grep compaction-context` print a line containing `active` (not `disabled`, not empty)?

Type `confirmed` to proceed.

## Known Limitations

### Discovery silent-skip (Phase H blocker #2)

Dropping the cloned tree into `~/.openclaw/extensions/compaction-context/`
with valid `openclaw.activation` + `openclaw.contributes` blocks is **not**
sufficient — verified absent from `openclaw plugins list` on 2026-05-16
with no diagnostic. Use the
`openclaw plugins install /tmp/compaction-context` step above (requires
operator gateway auth token). Re-run after every fresh clone.

## Next

→ `prompts/tools/45a-cortex-graph.md`
