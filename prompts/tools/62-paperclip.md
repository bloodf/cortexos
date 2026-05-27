# Paperclip

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

Purpose: install Paperclip as the only workflow and issue surface for
CortexOS. Paperclip calls Hermes profiles directly through the Hermes adapter.

## Contract

```text
Paperclip -> hermes_local adapter -> Hermes profile -> Honcho
```

Do not install a separate workflow bus, relay, or scheduler. Paperclip owns
issues, approvals, runs, and heartbeat scheduling.

## Runtime Ports

| Purpose | Endpoint |
| --- | --- |
| Local proxy | `http://127.0.0.1:3033` |
| Paperclip upstream | `http://127.0.0.1:3034` |
| Profile API example | `http://127.0.0.1:18691/v1` |

## Register Hermes Roles

```bash
set -euo pipefail
set -a
source /opt/cortexos/.secrets/paperclip.env
source /opt/cortexos/.secrets/9router.env
source /opt/cortexos/.secrets/honcho.env
export ROLES_DIR=/opt/cortexos/templates/agent-roles
export HERMES_COMMAND=/opt/cortexos/bin/hermes-paperclip
export HERMES_PROFILE_MAP='{"Secondary":"secondary"}'
set +a

node /opt/cortexos/scripts/paperclip-ensure-readiness-auth.mjs
pnpm --dir /opt/cortexos/scripts register-roles
```

`HERMES_PROFILE_MAP` is optional. Any role not listed maps to `primary`.
Private project role/profile routing is local runtime configuration and must
not be committed.

## Verify

```bash
curl -fsS http://127.0.0.1:3033/api/health
curl -fsS http://127.0.0.1:3034/api/health
node scripts/paperclip-hermes-smoke.mjs
```

Expected:

- Paperclip health is `ok`.
- A Hermes-backed run uses the expected profile.
- Honcho workspace is scoped to that profile.
- No custom workflow service is involved.

## Next

`70-dashboard.md`
