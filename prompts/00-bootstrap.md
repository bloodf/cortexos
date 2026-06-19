# CortexOS Interactive Installer — Pointer

> The actual install steps live in the numbered prompts under
> `prompts/tools/`. This document is the index that tells an
> operator **where to start and what to read first**. It does
> not duplicate install commands.

## Before you start

- Ubuntu 24.04 LTS or newer (Debian 13 also supported).
- SSH access to the target host with a sudo-capable user.
- Read `prompts/CHAT-INPUT-CONTRACT.md` — every numbered prompt
  follows the input-gate + reuse-gate pattern. You will be asked
  for values in chat, not via exported env vars.

## Order of operations

1. **Preflight** — `prompts/tools/00-preflight.md`
2. **Canonical install order** — `prompts/tools/_order.md`
   (lists every shipped install prompt, grouped by phase, in the
   order an operator runs them. Run them top-to-bottom.)
3. **Shared AI skills** — `prompts/tools/80-ai-harness-skills.md`
   (installs the same skill/prompt libraries into Hermes, Claude Code,
   Kimi Code, Cursor, Codex CLI, and Pi.)
3. **Per-project instance** — `prompts/tools/60-incus-project.md`

## Systemd units (host services)

The dashboard, hermes-gateway, and boxbox unit files
live as templates under `templates/systemd/`. They use
`{CORTEX_ROOT}` and `{CORTEX_SECRETS_DIR}` placeholders.

Render a template into `/etc/systemd/system/` with:

```bash
sudo bash scripts/ops/cortex-render-units.sh <unit-name>.service
```

The script auto-discovers the repo root from its own path,
substitutes the placeholders, runs `systemctl daemon-reload`,
and is idempotent. Override the placeholders via env:

```bash
sudo CORTEX_ROOT=/opt/cortexos CORTEX_SECRETS_DIR=/opt/cortexos/.secrets \
  bash scripts/ops/cortex-render-units.sh cortex-dashboard.service
```

## Per-prompt contracts

Every install prompt under `prompts/tools/NN-*.md` follows two
contracts that the operator should internalize once:

- `prompts/CHECKPOINT-PATTERN.md` — when a prompt stops, the
  reason is a yes/no question. Status banners do not halt. Each
  checkpoint cites the exact probe and the expected output.
- `prompts/CHAT-INPUT-CONTRACT.md` — values come from chat
  answers or runtime secret files, never from pre-exported env
  vars. Secrets stay under `/opt/cortexos/.secrets/`.

## Verification

After running the install prompts top-to-bottom, the canonical
smoke test lives at `scripts/smoke/real-host.sh`. Run it on the
target host after every major change.

## Where the legacy Next.js instructions went

The pre-TanStack Start version of this file taught operators to hand-
write a Next.js `cortex-dashboard.service` unit pointing at
`/opt/cortexos/packages/dashboard` and run `next build`. That
flow is retired. The current dashboard is a TanStack Start
Nitro/node-server build; the canonical unit template is
`templates/systemd/cortex-dashboard.service`; render it via
`scripts/ops/cortex-render-units.sh cortex-dashboard.service`
and follow `prompts/tools/70-dashboard.md`.
