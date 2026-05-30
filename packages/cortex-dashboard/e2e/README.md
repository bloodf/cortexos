# Dashboard E2E

Playwright specs are local-only. Keep them focused on browser behavior that can
run against the rebuilt dashboard without retired infrastructure.

```bash
pnpm --dir packages/cortex-dashboard run test:e2e:list
pnpm --dir packages/cortex-dashboard run test:e2e
```
