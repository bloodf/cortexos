# Paperclip + Hermes

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Configure Paperclip to run Hermes directly through `hermes-paperclip-adapter`.
This replaces the retired custom relay pipeline.

## Architecture

Preferred path:

```text
Paperclip -> hermes_local adapter -> Hermes profile -> Honcho -> Paperclip
```

Fallback path, only if Paperclip cannot load the adapter directly:

```text
Paperclip -> direct HTTP adapter shim -> hermes-paperclip-adapter -> Hermes
```

The fallback shim must not implement workflow, scheduling, or agent
communication logic.

## Register roles

Install the official adapter package in the Paperclip server runtime:

```bash
cd /opt/cortexos/stacks/paperclip
npm install hermes-paperclip-adapter
```

Register the adapter in Paperclip's adapter registry:

```typescript
import * as hermesLocal from "hermes-paperclip-adapter";
import {
  execute,
  testEnvironment,
  detectModel,
  listSkills,
  syncSkills,
  sessionCodec,
} from "hermes-paperclip-adapter/server";

registry.set("hermes_local", {
  ...hermesLocal,
  execute,
  testEnvironment,
  detectModel,
  listSkills,
  syncSkills,
  sessionCodec,
});
```

Use `scripts/paperclip-register-roles.ts` after Paperclip can load
`hermes_local`:

- Primary roles map to the `primary` Hermes profile.
- Secondary maps to the `secondary` Hermes profile.
- Role `routine` values are translated into Paperclip heartbeat schedules in
  `runtimeConfig.heartbeat`; schedules must stay owned by Paperclip.

Paperclip owns schedules, comments, issue assignment, budgets, approvals, and
status. Hermes owns execution, sessions, tools, skills, and messaging.
MCP configuration is owned by the Hermes profile and AgentGateway runtime
created in `42a-hermes-mcp.md`; Paperclip does not store MCP credentials or
generated profile files in the repository.

Required env:

```bash
PAPERCLIP_ADAPTER=hermes_local
HERMES_PROFILE_MAP='{"primary":"primary","secondary":"secondary"}'
CORTEX_PAPERCLIP_PROFILE_MAP='{"<paperclip-company-id>":"primary"}'
HERMES_COMMAND=/opt/cortexos/bin/hermes-paperclip
HERMES_PRIMARY_URL=http://127.0.0.1:18691/v1
HERMES_SECONDARY_URL=http://127.0.0.1:18692/v1
NINEROUTER_BASE_URL=http://127.0.0.1:11434/v1
```

Paperclip Hermes agents must use the Hermes CLI `custom` provider with
`baseUrl: http://127.0.0.1:11434/v1`; do not store local patches in
`node_modules`. Model fallback is configured in agent `adapterConfig.env` and
`runtimeConfig.modelProfiles.cheap` as a fallback lane, not as a cost policy.

Install `scripts/hermes-paperclip-wrapper.sh` to
`/opt/cortexos/bin/hermes-paperclip`. The wrapper normalizes `HOME`, derives
the profile when Paperclip passes typed env objects to the adapter process, and
execs the real Hermes CLI. It also rewrites stale provider flags to
`--provider custom`, strips `--resume` so old unauthenticated session history is
not reused, and runs `scripts/paperclip-prompt-guard.py` over Paperclip prompts.

Use `scripts/paperclip-hermes-control-fix.mjs --apply` after bootstrap or
Paperclip upgrades to reconcile all Hermes agents to the canonical
model/fallback/provider table. Use
`paperclip-recover-blocked-and-error-issues.timer` to retry blocked/error issues
after provider outages or bad-run cleanup.

## Install CortexOS Runtime Glue

Install these files from the org base repo into `/opt/cortexos`. Keep private
project profile mappings in `/opt/cortexos/.secrets/*.env`; do not commit them.

```bash
set -euo pipefail

install -m 0755 scripts/hermes-paperclip-wrapper.sh /opt/cortexos/bin/hermes-paperclip
install -m 0755 scripts/paperclip-prompt-guard.py /opt/cortexos/scripts/paperclip-prompt-guard.py
install -m 0644 scripts/paperclip-hermes-control-fix.mjs /opt/cortexos/scripts/paperclip-hermes-control-fix.mjs
install -m 0644 scripts/paperclip-recover-blocked-and-error-issues.mjs /opt/cortexos/scripts/paperclip-recover-blocked-and-error-issues.mjs

install -d -m 0755 /opt/cortexos/paperclip/runtime
install -m 0644 templates/paperclip/runtime/package.json /opt/cortexos/paperclip/runtime/package.json
cd /opt/cortexos/paperclip/runtime
npm install --omit=dev

install -m 0644 templates/systemd/paperclip-recover-blocked-and-error-issues.service /etc/systemd/system/paperclip-recover-blocked-and-error-issues.service
install -m 0644 templates/systemd/paperclip-recover-blocked-and-error-issues.timer /etc/systemd/system/paperclip-recover-blocked-and-error-issues.timer
systemctl daemon-reload
systemctl enable --now paperclip-recover-blocked-and-error-issues.timer
```

Then reconcile existing agents:

```bash
node /opt/cortexos/scripts/paperclip-hermes-control-fix.mjs --apply
node /opt/cortexos/scripts/paperclip-recover-blocked-and-error-issues.mjs --apply
```

The wrapper is intentionally outside Paperclip's installed package. If
`/opt/cortexos/paperclip/runtime/node_modules` is removed and reinstalled, the
CortexOS behavior remains in `/opt/cortexos/bin`, `/opt/cortexos/scripts`, and
systemd.

## Paperclip API auth for Hermes runs

Hermes agents must never call Paperclip without an auth header. For each
Paperclip-managed Hermes agent, mint a scoped agent API key, store only the
plaintext runtime map in a root/cortexos-owned secret file, and keep the DB with
only Paperclip's hashed key rows.

Use this runtime key map path:

```bash
/opt/cortexos/.secrets/paperclip-agent-runtime-keys.json
```

The wrapper and `paperclip-prompt-guard.py` ensure every prompted curl command
includes:

```bash
-H "Authorization: Bearer $(. /opt/cortexos/.secrets/paperclip.env; printf %s "$PAPERCLIP_API_KEY")" -H "X-Paperclip-Run-Id: ${PAPERCLIP_RUN_ID:-manual}"
```

Do not depend on unauthenticated localhost access. Authenticated Paperclip
deployments return `401` for those calls, which makes agents report "no work"
or block issues even when the issue assignment is correct.

## Verify

Run a Paperclip issue/comment wake for each profile and confirm Paperclip shows
the final status without any custom workflow bus.

## Next

→ `prompts/tools/44-api-exposure.md`
