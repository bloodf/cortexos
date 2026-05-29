# Cortex Dashboard

Next.js control console for the CortexOS rebuild.

Current responsibilities:

- Host service catalog and health.
- Protected Hermes profile visibility.
- Incus/project visibility.
- Secret-path browsing through an allowlist.
- Dashboard helper command audit.
- Local chat tools guarded by confirmation tokens.

The catalog source of truth is `migrations/002_seed.sql`. Fresh databases apply
only `001_schema.sql` and `002_seed.sql` (squashed from the pre-rebuild
incremental migrations).

Run locally:

```bash
pnpm --dir packages/cortex-dashboard test
pnpm --dir packages/cortex-dashboard run build:next
```
