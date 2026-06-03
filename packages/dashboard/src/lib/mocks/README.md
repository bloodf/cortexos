# `lib/mocks` — Deterministic E2E Mock API Architecture

> **M1-WS5 deliverable.** The foundation of the E2E testing strategy:
> a dual-layer mock API (browser MSW + SvelteKit `hooks.server.ts`)
> that lets every Playwright test run against a scripted reality
> without touching real Docker / Incus / systemd / PAM.
>
> Aligned with the M0-F test strategy §4 (two layers, one boundary)
> and the M0-C E2E coverage matrix (558 test rows, 34 sections).

---

## Why this exists

Per the M0-A architecture audit and the M0-E threat model:

- The dashboard code calls backend services from **both** the
  client (live updates via polling, future SSE) **and** the server
  (`+page.server.ts` loaders, form actions, future Remote
  Functions). One mock layer would miss half the surface.
- Every test must be deterministic (no `Date.now()`, no
  `Math.random()`-driven assertions). Fixtures are seeded.
- Mocks must **never** leak into production. Five layers of
  defence enforce this.

This module is the load-bearing piece. Every other M2 dashboard
test depends on it.

---

## Architecture

```
packages/dashboard/src/lib/mocks/
├── index.ts              # public API; enforces prod-leak guard
├── browser.ts            # MSW worker (lazy-loaded for browsers)
├── server.ts             # SvelteKit hooks.server.ts interceptor
├── prod-leak-guard.ts    # Layer 1+2 (env check, throw on prod import)
│
├── contracts/            # self-contained Zod schemas + error model
│   ├── primitives.ts     # branded ID types
│   ├── enums.ts          # status / category / class unions
│   ├── errors.ts         # CortexError discriminated union
│   ├── query.ts          # pagination / filter / sort conventions
│   ├── entities/         # one file per entity domain
│   │   ├── auth.ts       # User, Session, PamUser
│   │   ├── service.ts    # Service, ServiceCheck, ServiceHealthSnapshot
│   │   ├── system.ts     # SystemData, DriveInfo, MountInfo, etc.
│   │   ├── docker.ts     # DockerContainer, Image, Volume, Network
│   │   ├── incus.ts      # IncusInstance (live + DB), IncusImage
│   │   ├── systemd.ts    # SystemdUnit
│   │   ├── alerts.ts     # AlertRule, AlertHistory, AlertEvent
│   │   ├── audit.ts      # AuditEvent, DashboardCommandAudit
│   │   ├── approvals.ts  # ApprovalRequest
│   │   ├── admin.ts      # Badge, Project, Agent, MailReview
│   │   ├── misc.ts       # Backups, scheduler, notifications, env, logs, AI, dashboard prefs
│   │   └── terminal.ts   # TerminalSession, TerminalCommand
│   └── index.ts          # barrel
│
├── fixtures/             # deterministic faker factories
│   ├── seed.ts           # faker.seed(42) + counter reset
│   ├── auth-service.ts   # makeUser, makeService, makeAlertRule, …
│   ├── entities.ts       # makeSystemData, makeDockerContainer, …
│   └── index.ts          # barrel
│
├── scenarios/            # the 12 canonical scenarios
│   ├── types.ts          # Scenario, ScenarioContext, helpers
│   ├── canonical.ts      # the happy-path response builder
│   ├── happy.ts          # default — passes through canonical
│   ├── empty.ts          # all list endpoints return []
│   ├── error.ts          # 500 INTERNAL_ERROR on every endpoint
│   ├── denied.ts         # 401/403
│   ├── slow.ts           # 1.5s delay
│   ├── timeout.ts        # 10s delay
│   ├── destructive.ts    # X-Cortex-Confirmation-Token required
│   ├── approval.ts       # /api/approvals returns status=pending rows
│   ├── denied-rbac.ts    # standard user → admin endpoints
│   ├── denied-rht-2fa.ts # RHT surface requires 2FA
│   ├── denied-mfa.ts     # generic MFA challenge
│   ├── audit-fail.ts     # audit chain integrity check fails
│   └── index.ts          # registry + resolver
│
├── handlers/             # MSW v2 handler list
│   ├── cors.ts           # CORS preflight
│   └── index.ts          # ROUTES + handler factory
│
├── __tests__/            # vitest unit tests
│   ├── mocks.test.ts     # scenario + fixture round-trips
│   ├── scenarios.test.ts # scenario behaviour tests
│   ├── handlers.test.ts  # canonical response + handler coverage
│   └── prod-leak.test.ts # 5-layer prod-leak guard tests
│
└── README.md             # this file
```

---

## Scenario catalog

The 12 scenarios are the canonical switch positions an E2E test
can request. The matrix's "Mock API Scenario" column is the
source of truth for which scenario a given row uses.

| Name             | Status | Delay | Purpose |
|------------------|--------|-------|---------|
| `happy`          | 200    | —     | Default. All services online. |
| `empty`          | 200    | —     | All list endpoints return `[]`. |
| `error`          | 500    | —     | `INTERNAL_ERROR` envelope on every endpoint. |
| `denied`         | 401/403 | —    | `AUTH_ERROR` on `/api/auth`, `PERMISSION_DENIED` elsewhere. |
| `slow`           | 200    | 1.5s  | Loading-state proof. |
| `timeout`        | 200    | 10s   | Timeout-UI proof. |
| `destructive`    | 403→200 | —    | `APPROVAL_REQUIRED` without `X-Cortex-Confirmation-Token`. |
| `approval`       | 200    | —     | `/api/approvals` returns `status: 'pending'` rows. |
| `denied-rbac`    | 403    | —     | `requiredRole: 'admin'` on admin-only paths. |
| `denied-rht-2fa` | 401    | —     | RHT surfaces require 2FA challenge. |
| `denied-mfa`     | 401    | —     | Generic MFA challenge (TOTP/WebAuthn). |
| `audit-fail`     | 500    | —     | Audit chain integrity check fails. |

---

## How the scenario reaches the mocks

Three switch surfaces, in priority order:

1. **`x-mock-scenario` request header** (primary; set by Playwright
   via `extraHTTPHeaders` and per-request overrides).
2. **`?scenario=<name>` query param** (fallback for asset preloads
   or static links that cannot set headers).
3. **`x-mock-scenario` cookie** (set by `setScenario(page, name)` in
   the e2e helpers; survives navigations within a test).

Resolution order: header → query → cookie → `happy` (default).

### Browser fetches (MSW worker)

- Started by the SvelteKit `+layout.svelte` in dev/test mode
  (M1-WS2 will wire this; until then, `startWorker()` is exposed
  for tests to call directly).
- Reads the header / query from each `fetch()` call.
- Returns the scenario's response (or falls through to the
  canonical happy path if the scenario's `matches` returns false).

### Server-side fetches (SvelteKit `handle` hook)

- `src/hooks.server.ts` imports `installMockHandleFromEnv` and
  chains it via `sequence(...)`:
  ```ts
  // src/hooks.server.ts
  import { sequence } from '@sveltejs/kit/hooks';
  import { installMockHandleFromEnv } from '$lib/mocks/server';
  import { handle as authHandle } from '$lib/server/auth/handle';
  export const handle = sequence(installMockHandleFromEnv(), authHandle);
  ```
- Reads `E2E_MOCK_MODE` from the process env. When `1`, the hook
  intercepts every `/api/*` request whose scenario `matches` returns
  true, and returns the scenario's response.
- Production: `E2E_MOCK_MODE` is **never** set. The hook is a
  no-op pass-through. (Layer 1 prod-leak guard.)

---

## The 5-layer prod-leak guard

| # | Mechanism | Where |
|---|-----------|-------|
| 1 | `enforceMockMode(side)` checks `import.meta.env.MODE` and `NODE_ENV` at module load. Production imports throw. | `prod-leak-guard.ts`; called from `index.ts`, `browser.ts`, `server.ts`. |
| 2 | Same module's `assertMocksNeverRunInProduction()` fatal assertion. Layer 1+2 are layered. | `prod-leak-guard.ts`. |
| 3 | `scripts/check-mock-leaks.sh` — a CI grep gate that fails the build if `from '$lib/mocks'` appears outside the allowlist (`src/hooks.server.ts`, `src/lib/mocks/**`, `__tests__/`). | `scripts/check-mock-leaks.sh` + CI workflow (M1-WS7). |
| 4 | Vite tree-shaking: the mocks folder is never imported from `+page.svelte` or `+layout.svelte`. The only legitimate importers are `src/hooks.server.ts` and the mocks' own entry points. | Verified by `prod-leak.test.ts` Layer 4. |
| 5 | `mocks-cannot-leak-into-prod` vitest suite asserts the import boundary, the module-load guard, the scenario registry, and the CI grep script. | `__tests__/prod-leak.test.ts`. |

A production build that accidentally imports the mocks layer:
- Fails the module-load guard at runtime (Layer 1+2 — visible in the
  Node.js boot log as `[mocks] CRITICAL: mocks cannot run in production`).
- Fails the CI grep gate before merge (Layer 3 — `check-mock-leaks.sh`).
- Fails the vitest test suite (Layer 5 — `prod-leak.test.ts`).

---

## API for M2 implementers

### Add a new scenario

1. Add the name to `SCENARIO_NAMES` in `scenarios/types.ts`.
2. Create `scenarios/<name>.ts` exporting a default `Scenario`.
3. Register it in `scenarios/index.ts`.
4. (Optional) Add a test in `__tests__/scenarios.test.ts`.
5. (Optional) Add a sample in `e2e/helpers/scenario.ts` so other
   agents can call `setScenario(page, '<name>')` without reading
   the source.

### Add a new route

1. Add the path template + methods to `ROUTES` in `handlers/index.ts`.
2. Add the canonical response builder in `scenarios/canonical.ts`.
3. Add a test in `__tests__/handlers.test.ts` asserting the
   canonical response is non-null for the new endpoint.

### Use fixtures in a non-mock test (unit / contract)

```ts
import { makeService, makeAdminUser } from '$lib/mocks/fixtures';
import { serviceSchema } from '$lib/mocks/contracts';

const svc = makeService({ slug: 'grafana' });
expect(serviceSchema.parse(svc)).toBeDefined();
```

Fixtures are deterministic given the seed. `seedFaker(42)` is the
default; tests that need a different seed call `withFakerSeed(n, fn)`.

### Use the scenario in an E2E test

```ts
import { test, expect } from '@playwright/test';
import { setScenario } from './helpers/scenario';

test('docker page shows the empty state', async ({ page }) => {
  await setScenario(page, 'empty');
  await page.goto('/docker');
  await expect(page.getByText('No results')).toBeVisible();
});

test('docker start fails with an error toast', async ({ page }) => {
  await setScenario(page, 'error');
  await page.goto('/docker');
  await page.getByRole('button', { name: 'Start' }).first().click();
  await expect(page.getByText(/Failed to start/)).toBeVisible();
});
```

### When fixtures aren't enough (custom response shape)

Add a new scenario in `scenarios/<name>.ts`. The scenario receives
a `ScenarioContext` with the URL, method, headers, body, path
template, and path params. Return a `Response` and the handler
wraps it in an MSW/SvelteKit response.

---

## Determinism contract

The M0-F test strategy §7.3 forbids non-deterministic randomness
in the data plane. The mocks layer:

- Calls `faker.seed(42)` on module load.
- Resets the shared ID counter whenever a new seed is applied
  (`seedFaker` and `withFakerSeed`).
- Uses `FROZEN_NOW = '2026-06-03T13:00:00.000Z'` for all
  timestamps instead of `Date.now()`.
- Computes offsets from `FROZEN_NOW_EPOCH` (no `Date.now()`).

The data plane is **byte-deterministic** across runs given the
same import order. Flake budget: 0% on `main`.

---

## Future work (M2 / M3)

- **M2**: every M2 dashboard PR wires the new pages to the
  fixtures and adds rows to the E2E matrix. The canonical response
  builder gets extended as new entities land.
- **M3**: SSE / WebSocket handlers for terminal, alerts, and
  audit live-stream. The MSW worker needs the WebSocket
  interceptor; the SvelteKit `handle` hook needs to forward
  `text/event-stream` responses.
- **M3**: the `approval` flow's HMAC-SHA256 + single-use cache
  (per M0-E SR-020) is wired into the destructive + approval
  scenarios. The mock currently only checks for the
  `X-Cortex-Confirmation-Token` header presence; the real
  cryptographic check lives in the M3 backend.

---

## Acceptance checklist

- [x] MSW browser handlers for all 11+1 sample `+server.ts` routes
      (handlers/index.ts).
- [x] SvelteKit `hooks.server.ts` interceptor (server.ts).
- [x] 12-scenario catalog (happy / empty / error / denied / slow /
      timeout / destructive / approval / denied-rbac /
      denied-rht-2fa / denied-mfa / audit-fail).
- [x] faker fixtures for 28+ entities, deterministic via `seed(42)`.
- [x] 5-layer prod-leak guard (env check, NODE_ENV throw, CI grep,
      tree-shake, vitest).
- [x] Playwright `x-mock-scenario` header + e2e helper.
- [x] Tests:
  - `mocks.test.ts` — every scenario type produces valid data
  - `prod-leak.test.ts` — 5-layer guard assertions
  - `scenarios.test.ts` — scenario behaviour
  - `handlers.test.ts` — canonical response + handler coverage
- [x] Documentation for M2 implementers (this README).
