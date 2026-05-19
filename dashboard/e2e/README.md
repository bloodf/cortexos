# Dashboard E2E (Playwright) — local-only

Playwright specs in this directory are **local-only** by repository policy.
They are not executed in any GitHub Actions workflow. The dedicated
`e2e-dashboard.yml` workflow has been removed.

## Run locally

```bash
cd dashboard
npm install
npx playwright install --with-deps   # one-time
npm run test:e2e                      # runs `playwright test`
npm run test:e2e:list                 # lists discovered specs
```

## Why local-only

- CI runtime budget: full browser install + spec run inflates job time.
- Flakiness surface: live Postgres / NATS dependencies are easier to
  reproduce on a developer machine than in a hermetic runner.
- Operator preference: see repo-level CI policy.

## Suites

| Spec                     | Coverage                              |
| ------------------------ | ------------------------------------- |
| `alerts-flow.spec.ts`    | Alerts publish → NATS round trip      |
| `audit-viewer.spec.ts`   | Audit viewer + chain-verify badge     |
| `paperclip-flow.spec.ts` | Approval queue + signal publish       |

## Notes

- `@playwright/test` and `playwright` remain in `dashboard/devDependencies`
  so the suites stay runnable. They do not impact the dashboard build
  artifact (devDeps are pruned in production install).
- Do not re-introduce a GitHub Actions workflow for these specs without
  explicit operator approval.
