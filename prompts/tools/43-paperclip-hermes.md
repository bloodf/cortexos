# Paperclip + Hermes

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

Required env:

```bash
PAPERCLIP_ADAPTER=hermes_local
HERMES_PROFILE_MAP='{"primary":"primary","secondary":"secondary"}'
HERMES_COMMAND=/opt/cortexos/bin/hermes-paperclip
HERMES_PRIMARY_URL=http://127.0.0.1:18691/v1
HERMES_SECONDARY_URL=http://127.0.0.1:18692/v1
NINEROUTER_BASE_URL=http://127.0.0.1:11434/v1
```

Each Hermes profile must define the native custom provider `9router` in its
`config.yaml`; Paperclip passes it through the official adapter with
`extraArgs: ["--provider", "9router"]`. Keep the adapter `provider` field set
to `auto` because `hermes-paperclip-adapter` does not currently allow
user-defined provider names in that field.

Install `scripts/hermes-paperclip-wrapper.sh` to
`/opt/cortexos/bin/hermes-paperclip`. The wrapper normalizes `HOME`, derives
the profile when Paperclip passes typed env objects to the adapter process, and
execs the real Hermes CLI.

## Verify

Run a Paperclip issue/comment wake for each profile and confirm Paperclip shows
the final status without any custom workflow bus.

## Next

→ `prompts/tools/44-api-exposure.md`
