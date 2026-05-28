# Cortex Dashboard

Next.js control console for the CortexOS rebuild.

Current responsibilities:

- Host service catalog and health.
- Protected Hermes profile visibility.
- Incus/project visibility.
- Secret-path browsing through an allowlist.
- Dashboard helper command audit.
- Local chat tools guarded by confirmation tokens.

The catalog source of truth is `migrations/002_seed.sql`; upgraded databases
are cleaned by `migrations/017_retired_infra_cleanup.sql`.

Run locally:

```bash
pnpm --dir packages/cortex-dashboard test
pnpm --dir packages/cortex-dashboard run build:next
```
