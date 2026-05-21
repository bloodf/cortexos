# Paperclip

## Purpose

Install Paperclip as the only CortexOS work orchestration surface. Paperclip
assigns work directly to Hermes through `hermes-paperclip-adapter`.

## Prerequisites

- `43-paperclip-hermes.md` completed.
- `44-api-exposure.md` completed if local-machine API access is required.

## Architecture

```text
Paperclip -> hermes_local adapter -> Hermes profile -> Honcho -> Paperclip
```

Do not install a custom bridge, workflow bus, gateway workflow, or legacy
runtime relay.

## Install

Install or update Paperclip following the project-approved pin. Then register
Hermes-backed roles with:

```bash
set -a
source /opt/cortexos/.secrets/paperclip.env
source /opt/cortexos/.secrets/9router.env
source /opt/cortexos/.secrets/honcho.env
export HERMES_PROFILE_MAP='{"Secondary":"secondary"}'
export HERMES_COMMAND=/opt/cortexos/bin/hermes-paperclip
set +a

tsx scripts/paperclip-register-roles.ts --roles-dir templates/agent-roles
```

Required Paperclip adapter config:

| Paperclip project | Hermes profile | API |
| --- | --- | --- |
| `primary` | `primary` | `http://127.0.0.1:18691/v1` |
| `secondary` | `secondary` | `http://127.0.0.1:18692/v1` |

Each role template must define a Paperclip `routine`. The registration script
converts supported cron forms such as `0 */15 * * * *` into
`runtimeConfig.heartbeat.intervalSec`, so Paperclip remains the only scheduler
for Hermes work.

The Hermes adapter config must use `provider: auto` plus
`extraArgs: ["--provider", "9router"]`. The `9router` provider itself belongs
in each Hermes profile `config.yaml`, with `NINEROUTER_API_KEY` loaded from the
profile `.env`.

If Paperclip cannot load `hermes-paperclip-adapter` directly, deploy only the
minimal direct HTTP adapter shim described in `43-paperclip-hermes.md`.

## Verify

Run one Paperclip issue/comment wake per profile and confirm:

- Paperclip creates the run.
- Hermes executes the run under the expected profile.
- Honcho memory is scoped to that profile.
- Paperclip receives the final status.
- No custom workflow bus is involved.

Then run the smoke helper:

```bash
node scripts/paperclip-hermes-smoke.mjs
HERMES_SMOKE_RUN=1 node scripts/paperclip-hermes-smoke.mjs
```

## Next

→ `prompts/tools/70-dashboard.md`
