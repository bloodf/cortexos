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

Install Paperclip from the pinned runtime package template, then install the
CortexOS wrapper and recovery glue outside `node_modules`:

```bash
set -euo pipefail

install -d -m 0755 /opt/cortexos/paperclip/runtime
install -m 0644 /opt/cortexos/templates/paperclip/runtime/package.json /opt/cortexos/paperclip/runtime/package.json
cd /opt/cortexos/paperclip/runtime
npm install --omit=dev

install -m 0755 /opt/cortexos/scripts/hermes-paperclip-wrapper.sh /opt/cortexos/bin/hermes-paperclip
install -m 0755 /opt/cortexos/scripts/paperclip-prompt-guard.py /opt/cortexos/scripts/paperclip-prompt-guard.py
install -m 0644 /opt/cortexos/scripts/paperclip-hermes-control-fix.mjs /opt/cortexos/scripts/paperclip-hermes-control-fix.mjs
install -m 0644 /opt/cortexos/scripts/paperclip-recover-blocked-and-error-issues.mjs /opt/cortexos/scripts/paperclip-recover-blocked-and-error-issues.mjs
install -m 0644 /opt/cortexos/templates/systemd/paperclip-recover-blocked-and-error-issues.service /etc/systemd/system/paperclip-recover-blocked-and-error-issues.service
install -m 0644 /opt/cortexos/templates/systemd/paperclip-recover-blocked-and-error-issues.timer /etc/systemd/system/paperclip-recover-blocked-and-error-issues.timer
systemctl daemon-reload
systemctl enable --now paperclip-recover-blocked-and-error-issues.timer
```

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
node /opt/cortexos/scripts/paperclip-hermes-control-fix.mjs --apply
node /opt/cortexos/scripts/paperclip-recover-blocked-and-error-issues.mjs --apply
```

`HERMES_PROFILE_MAP` is optional. Any role not listed maps to `primary`.
Private project role/profile routing is local runtime configuration and must
not be committed. If Paperclip passes typed env objects to the adapter process,
`/opt/cortexos/bin/hermes-paperclip` derives a valid profile from the optional
`CORTEX_PAPERCLIP_PROFILE_MAP` runtime secret and falls back to `primary`.

Do not edit `node_modules`. Reinstall Paperclip dependencies with `npm install`
inside `/opt/cortexos/paperclip/runtime`; keep CortexOS behavior in
`/opt/cortexos/bin`, `/opt/cortexos/scripts`, and systemd templates.

## Verify

```bash
curl -fsS http://127.0.0.1:3033/api/health
curl -fsS http://127.0.0.1:3034/api/health
node scripts/paperclip-hermes-smoke.mjs
node scripts/paperclip-hermes-control-fix.mjs
node scripts/paperclip-recover-blocked-and-error-issues.mjs
```

Expected:

- Paperclip health is `ok`.
- A Hermes-backed run uses the expected profile.
- Agents use `provider: custom`, `persistSession: false`, and configured
  primary/fallback models.
- Recovery reports zero currently recoverable blocked/error issues after repair.
- Honcho workspace is scoped to that profile.
- No custom workflow service is involved.

## Next

`70-dashboard.md`
