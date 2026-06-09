# Rebuild Status Ledger

> Agents: update your WP's row when you START (status `wip`, set Owner) and FINISH (status
> `done`, add the commit SHA). One line per WP. Do not start a WP whose Depends-on is not
> `done`. Legend: `todo` · `wip` · `blocked` · `done`.

## Done before this board
- Phase 0 foundation (sys-pilot vendored, pnpm, green build) — commit `f6a5ce5`
- API foundation (legacy backend hardened = the API to port) — commit `57a06d3`

## Wave 0 — foundation (sequential)
| WP | Title | Depends-on | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-00 | node-server preset + runtime boot | — | done | claude | (pending) |
| WP-02 | DB port | — | done | claude | (this commit) |
| WP-03 | security cores (portable) | WP-02 | done | claude | (this commit) |
| WP-01 | request core → defineServerFn middleware (see ADR-001) | WP-02, WP-03 | done | claude | runtime-proven on built node server |
| WP-04 | frontend client → RPC facades (see ADR-001) | — (contract) | wip | claude | scaffolding done; RPC rework |

> **TRANSPORT CORRECTION — read `ADR-001-server-transport.md`.** The framework
> (`@tanstack/react-start@1.168`) has NO REST/HTTP server routes — only `createServerFn` RPC.
> WP-01 (defineApiRoute/`/api/*`) and WP-04 (fetch client) are reworked onto server fns; the
> `01`/`02` REST framing and all Wave-1/2 specs are amended to RPC. **Fan-out of Waves 1 & 2
> is PAUSED until WP-01/WP-04 are re-proven on the corrected transport.** WP-00/02/03 stand.

### Server-function convention (Wave 0 — follow this in Wave 1; see ADR-001)
Transport is `createServerFn` **RPC**, not REST. There are NO `/api/*` route files. Each
backend endpoint is a server function in `src/lib/api/<domain>.functions.ts`, gated by
`defineServerFn` (`src/lib/api/define-server-fn.ts`) and written at module top level:

```ts
// src/lib/api/services.functions.ts
import { createServerFn } from '@tanstack/react-start';
import { defineServerFn, serverFnNoop } from '@/lib/api/define-server-fn';
import { z } from 'zod';

const gate = defineServerFn({
  method: 'GET',                 // 'GET' read · 'POST' mutation
  auth: 'any',                   // 'public' | 'any' | 'admin' | GroupName
  input: z.object({ q: z.string().optional() }),   // optional; 400 on failure
  surface: 'services',
  action: 'services.list',
  // approval: true,             // optional: consume single-use approval token
  // target: (input) => input.id,// optional audit target (never a secret)
  handler: async ({ input, user, ctx }) => {
    const { listServices } = await import('@/server/services/repo');  // dynamic!
    return listServices(input.q);
  },
});
export const listServices = createServerFn({ method: 'GET' })
  .middleware([gate])
  .handler(serverFnNoop);
```

**Why this exact shape (compiler + import-protection constraints — proven, do not deviate):**
- `defineServerFn(opts)` returns a TanStack **function middleware**, NOT a finished server
  fn. The compiler requires every `createServerFn(...)` to be assigned to a top-level
  variable, and only EXTRACTS (server-strips) a `.handler()` body at a top-level literal
  site. A factory that returned `createServerFn().handler()` fails the compiler AND leaks its
  `src/server` import into the client bundle (import-protection `Denied by file pattern:
  src/server`). `createMiddleware().server()` bodies ARE extracted (even from a factory), so
  the gate is a middleware.
- The `handler` you pass to `defineServerFn` runs INSIDE the extracted gate, so its
  `await import('@/server/...')` is server-only. Always import server modules **dynamically
  inside the handler** — never statically at the top of a `*.functions.ts` file.
- The top-level `.handler(serverFnNoop)` is a trivial passthrough; the gate computes + sets
  the result.
- Frontend calls the fn directly (typed RPC): `await listServices({ data: { q } })` from a
  loader/component — no `fetch('/api/...')`.

Pipeline (per request, inside the gate → `server-fn-runner.server.ts` → `defineApiRoute`):
resolveContext → method match → input validate (400+details) → auth/RBAC (401/403) → CSRF on
mutations (double-submit + session-bound; 403, 401 if no session) → rate-limit (429+Retry-
After) → optional approval consume (412) → handler → audit (success AND failure, never
throws) → typed success/error envelope. Gate failures are thrown as a `Response` and returned
verbatim by the RPC handler (status + body + headers preserved).

Reference + full docs: `src/lib/api/define-server-fn.ts`, `src/lib/api/server-fn-runner.server.ts`,
`src/server/server-fn-pipeline.ts`.

### WP-01 runtime evidence (proven on the BUILT node server, not just compile)
`pnpm --filter @cortexos/dashboard-next build` is green and `node .output/server/index.mjs`
boots ("Listening on http://localhost:PORT/"). A temporary probe route drove the gate through
the real createServerFn runtime (`getRequest()` reading the live request) — all 10 gates
passed (probe since removed):

| scenario | expected | got |
|----------|----------|-----|
| auth:any GET, no session | 401 `auth` | 401 ✅ |
| auth:any GET, valid session | 200 | 200 ✅ |
| auth:admin GET, non-admin | 403 `permission` | 403 ✅ |
| auth:admin GET, admin | 200 | 200 ✅ |
| auth:any GET, bad input (`n=not-a-number`) | 400 `validation` | 400 ✅ |
| POST mutation, no CSRF header | 403 `permission` | 403 ✅ |
| POST mutation, stolen CSRF cookie (no header) | 403 | 403 ✅ |
| POST mutation, mismatched CSRF header | 403 | 403 ✅ |
| POST mutation, valid session-bound CSRF | 201 | 201 ✅ |
| POST mutation, no session | 401 `auth` | 401 ✅ |

Kept: `defineServerFn` + `server-fn-runner.server.ts` + `server-fn-pipeline.ts` + the unit
test `src/lib/api/__tests__/define-server-fn.test.ts` (13 tests, exercises the gate pipeline).
Note: server-fn handler bodies only run under the Vite/Nitro build transform — a bare
`await fn()` in vitest never invokes the extracted handler, so the end-to-end RPC proof is the
built-server probe above, and the unit test covers the pipeline directly.

**Dead REST artifacts removed:** `src/routes/api/_ping.ts` (+ its test) and the REST-named
`src/server/define-api-route.ts` (relocated to `src/server/server-fn-pipeline.ts`).

## Wave 1 — backend domains (PARALLEL; need WP-01+WP-02)
| WP | Title | Extra deps | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-10 | api services + health | — | done | | |
| WP-11 | api docker | — | todo | | |
| WP-12 | api incus | — | todo | | |
| WP-13 | api systemd | — | todo | | |
| WP-14 | api system/net/proc/storage | — | todo | | |
| WP-15 | api mail-guardian | — | todo | | |
| WP-16 | api approvals + audit | WP-03 | todo | | |
| WP-17 | api alerts | — | todo | | |
| WP-18 | api env-browser | WP-03 | todo | | |
| WP-19 | api terminal (WS PTY) | — | todo | | |
| WP-20 | api auth | WP-03 | todo | | |
| WP-21 | api agents | — | todo | | |

### WP-10 — services + health (done; REFERENCE Wave-1 backend, createServerFn-RPC per ADR-001)
Implemented as typed `createServerFn` RPC, NOT REST (the WP file's `/api/*` route design was
superseded by ADR-001). Files created:
- `src/lib/api/services.functions.ts` — 7 server fns, each a top-level
  `createServerFn(...).middleware([gate]).handler(serverFnNoop)` literal with `gate =
  defineServerFn({...})` and all `@/server/**` logic via dynamic `await import()` inside the
  handler: `listServices` (GET any), `getService` (GET any, 404), `createService` (POST admin),
  `patchService` (POST admin, 404), `deleteService` (POST admin, 404), `listServiceHealth`
  (GET any), `recheckServiceHealth` (POST admin, rate-limit 10/min/user).
- `src/server/health/scheduler.ts` — ported verbatim from legacy
  `packages/dashboard/src/lib/server/health/scheduler.ts` (SvelteKit `$lib` aliases → relative
  `../db/*`). `startHealthScheduler()` idempotent singleton, immediate sweep + 60s `setInterval`
  with `timer.unref()`, `sweepOnce()` (`activeOnly:true, pageSize:500`), and `probe()` exported
  for reuse by the manual recheck. http/tcp/systemd/docker/process probes via `execFile`.
- `src/server/health/index.ts` — barrel re-exporting `startHealthScheduler`, `sweepOnce`, `probe`.
- `src/server/runtime.ts` — `bootRuntime()` now calls `startHealthScheduler()` (the WP-00 hook;
  `src/server.ts` already calls `bootRuntime()` once at boot).
- `src/lib/api/__tests__/services.functions.test.ts` — node-env gate tests (auth:any 200/401,
  admin 403/CSRF-stolen 403/valid-CSRF 201) for the services.list + services.create gates.

Evidence: `pnpm --filter @cortexos/dashboard-next build` GREEN — the services server fns +
scheduler compile into `.output/server/_ssr/index.mjs` (proves the createServerFn pattern +
import-protection: zero `@/server` leak into `.output/public`). `tsc --noEmit` = 0 errors.
`vitest run src/server src/lib/api` = 208 passed (20 files), includes the 5 new WP-10 gate tests.
No dependency changes; no edits outside WP-10's reused surface (db/auth/errors untouched).

## Wave 2 — frontend route-groups (PARALLEL; need WP-04)
| WP | Title | Pairs with | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-30 | shell/nav/auth/login | WP-20 | todo | | |
| WP-31 | overview | WP-10,14 | todo | | |
| WP-32 | apps + healthcheck | WP-10 | todo | | |
| WP-33 | docker | WP-11 | todo | | |
| WP-34 | incus + wizard | WP-12 | todo | | |
| WP-35 | systemd | WP-13 | todo | | |
| WP-36 | system/net/storage/proc/terminal | WP-14,19 | todo | | |
| WP-37 | mail-guardian | WP-15 | todo | | |
| WP-38 | approvals + audit | WP-16 | todo | | |
| WP-39 | alerts | WP-17 | todo | | |
| WP-40 | admin | WP-10,18 | todo | | |
| WP-41 | agents | WP-21 | todo | | |

## Wave 3 — verify & cutover (sequential)
| WP | Title | Depends-on | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-50 | security test suite (GATE) | all Wave 1 | todo | | |
| WP-51 | parity verification | all W1+W2 | todo | | |
| WP-52 | build + systemd cutover | WP-50, WP-51 | todo | | |

## Wave 4 — post-cutover
| WP | Title | Depends-on | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-53 | i18n es/pt-br | WP-52 | todo | | |
| WP-54 | legacy removal + docs | WP-52 | todo | | |
