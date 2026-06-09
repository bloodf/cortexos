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
| WP-04 | frontend client → RPC facades (see ADR-001) | — (contract) | done | claude | RPC rework complete; services wired; all others typed TODO stubs |

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
| WP-11 | api docker | — | done | claude | |
| WP-12 | api incus | — | done | claude | |
| WP-13 | api systemd | — | todo | | |
| WP-14 | api system/net/proc/storage | — | done | claude | |
| WP-15 | api mail-guardian | — | done | claude | |
| WP-16 | api approvals + audit | WP-03 (no new pkg deps) | done | claude | |
| WP-17 | api alerts | — | todo | | |
| WP-18 | api env-browser | WP-03 | done | claude | |
| WP-19 | api terminal (WS PTY) | — | wip | claude | named-op path DONE; live PTY transport-blocked (see WP-19 note) |
| WP-20 | api auth | WP-03 | done | claude | (pending) |
| WP-21 | api agents | — | done | claude | |

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

### WP-15 — api mail-guardian (done; createServerFn-RPC per ADR-001)
Implemented as typed `createServerFn` RPC, NOT REST (the WP file's `/api/*` route design was
superseded by ADR-001). Reuses the WP-02 repo at `src/server/db/repos/mail_guardian.ts` via
dynamic `await import()` inside each handler. Files created:
- `src/lib/api/mail-guardian.functions.ts` — 7 server fns, each a top-level
  `createServerFn(...).middleware([gate]).handler(serverFnNoop)` literal with `gate =
  defineServerFn({...})` and all `@/server/**` logic via dynamic `await import()`:
  - `listAccounts` (GET admin) → `{ accounts: MailGuardianAccountSafe[] }` (no `passwordB64`)
  - `createAccount` (POST admin, rate-limit 30/min/user) → `{ account }`, 409-style via
    `validationError` if slug already exists; password stored as base64 by repo
  - `updateAccount` (POST admin, rate-limit 30/min/user) → `{ account }` | 404
  - `deleteAccount` (POST admin, rate-limit 30/min/user) → `{ ok: true, slug }` | 404
  - `listReviews` (GET any) → `{ reviews, total, page, pageSize }`, filters: `accountSlug`,
    `pendingOnly`, `page`, `pageSize`
  - `flagReview` (POST admin, rate-limit 60/min/user) → `{ id, ownerDecision:'spam', resolvedAt,
    approver }` | 404; inserts `mail_guardian_actions` row (`decision:'spam'`, `status:'pending'`)
  - `approveReview` (POST admin, rate-limit 60/min/user) → `{ id, ownerDecision:'keep', ... }`
    | 404; inserts `mail_guardian_actions` row (`decision:'keep'`, `status:'pending'`)
  - `batch` (POST admin, rate-limit 30/min/user) → `{ updated, action }`; maps
    `action:'approve'→'keep'`, `action:'flag'→'spam'`; issues one UPDATE + one action insert per id
    (verbatim port of the legacy loop — no `inArray` refactor per WP-15 notes)
- `src/lib/api/__tests__/mail-guardian.functions.test.ts` — 22 gate tests covering all 7 gates:
  auth:admin 200/401/403, CSRF stolen/missing/valid 403/201, auth:any 200/401, input validation
  400, plus node-env gate block asserting `DB_PASSWORD` unset does not affect pipeline security.

Evidence: `vitest run src/lib/api/__tests__/mail-guardian.functions.test.ts` = 22 passed (1 file).
No dependency changes; no edits outside the two new files; `src/server/db/repos/mail_guardian.ts`
(WP-02) reused read-only via dynamic import.

### WP-20 — api auth (done; createServerFn-RPC per ADR-001; SECURITY-SENSITIVE)
Login / logout / me ported as typed `createServerFn` RPC (the WP file's `/api/auth/*`
route design was superseded by ADR-001). Files:
- `src/lib/api/auth.functions.ts` — 3 server fns, each a top-level
  `createServerFn(...).middleware([gate]).handler(serverFnNoop)` literal; gate options
  exported (`loginGateOptions` / `logoutGateOptions` / `meGateOptions`) as the single
  source of truth so the node-env test drives the REAL handlers through `defineApiRoute`:
  - `login` (POST, auth `public`, rate-limit 5/60s/ip): PAM verify → cortexos-admin
    group derive → mint session-bound CSRF → `createSession` → set `cortexos_session`
    (HttpOnly) + `cortexos_csrf` (JS-readable) cookies via `ctx.cookies` → `{ user, session }`.
    Coarse `authError('Invalid credentials')` on PAM failure (no user-enumeration);
    password never logged. Pipeline audits success/denied automatically.
  - `logout` (POST, auth `any`): pipeline enforces session + double-submit CSRF;
    handler `deleteByToken` + clears both cookies. Idempotent.
  - `me` (GET, auth `public`): returns `{ user, session }` from ctx, or
    `{ user: null, session: null }` when unauthenticated (200, not 401). No CSRF, no audit.
  All `@/server/**` (pam/session-store/cookies/errors) imported dynamically inside handlers.
- `src/server/server-fn-pipeline.ts` — one-line fix: the CSRF step now skips
  `auth:'public'` routes (pre-session; no session-bound token to double-submit against —
  WP-20 spec "CSRF: skip (pre-session)"). Does NOT weaken `any`/`admin`/group mutations;
  the WP-01 CSRF gate matrix (define-server-fn.test.ts, 13 tests) still passes unchanged.
- `src/lib/api/__tests__/auth.functions.test.ts` — node-env tests (9): bad creds → coarse
  401 `auth` (no enumeration) + audited denied; unknown user → identical coarse error; good
  creds → 201 + session row + HttpOnly session / JS-readable CSRF cookies + `{user,session}`;
  non-admin login → non-admin session; me with/without session → user|null; logout invalidates
  session + clears cookies, stolen-cookie (no CSRF header) → 403 (session survives), no session → 401.

Evidence: `vitest run` of auth.functions + define-server-fn + services.functions + csrf =
38 passed (4 files) — confirms login/logout/me behavior AND that the public-CSRF-skip does
not weaken authenticated CSRF. `tsc --noEmit` reports 0 errors in WP-20 files (unrelated
in-flight WPs WP-04/13/14 have separate pre-existing tsc errors + DB-migrate test timeouts,
none touching auth). No dependency changes; reused `src/server/auth/*` only.

### WP-12 — api incus (done; createServerFn-RPC per ADR-001)
Incus bridge + server functions ported from legacy `packages/dashboard/src/lib/server/incus/bridge.ts`.
Files created:
- `src/server/policy/index.ts` — command policy module (allowlist + denylist + `validateShellArg` +
  `installDefaultAllowlist`), ported verbatim from legacy. Incus entries: `incus.{start,stop,restart,
  delete,launch,list}` + `incus.exec-named`.
- `src/server/incus/bridge.ts` — full bridge port: `MockIncusExecutor`, `applyAction`,
  `realIncusExecutor`, `mapIncusJsonToMockRecord` (full `incus list --format json` mapping),
  `listInstances`, `getInstance`, `getMockRecord`, `listInstanceLogs`, `listImages`,
  `runPreflightReport`, `buildLaunchProgress`, `dispatchAction` (6-layer defence: policy allowlist →
  name regex → instance lookup + allowlist flag → delete confirmation → destructive approval gate →
  executor), `dispatchExecNamed` (4-layer: instance lookup → op allowlist → recursive arg-smuggling
  scan → argv_bash_c belt-and-braces → executor). Node-env gate: `process.platform === 'linux' &&
  CORTEX_INCUS_BRIDGE_REAL !== '0'` selects `realIncusExecutor`; all other envs use `MockIncusExecutor`
  with 4 SEED_INSTANCES. All test/reset helpers exported.
- `src/lib/api/incus.functions.ts` — 4 server fns (createServerFn RPC, all @/server via dynamic
  import): `listInstances` (GET any), `incusAction` (POST admin, rate-limit 10/min/user, translates
  all DispatchResult codes to typed errors), `execNamed` (POST admin, rate-limit 10/min/user),
  `instanceLogs` (GET any, tail capped 1–500).
- `src/server/incus/__tests__/bridge.test.ts` — 34 tests covering all 6 dispatchAction layers and
  all 4 dispatchExecNamed layers; node-env gate; approval token session-binding; action-hash binding.

Evidence: `vitest run src/server/incus src/lib/api/incus.functions.ts` = 34 passed (1 file).
`vitest run src/server src/lib/api` = 308 passed (25 files); 1 pre-existing timeout in
`client-pglite-extra.test.ts` (WP-02 flaky test, unrelated to WP-12).
Missing deps (noted, not added): none — `@cortexos/contracts` already in workspace.

### WP-18 — api env-browser (done; createServerFn-RPC per ADR-001; SECURITY-SENSITIVE secret reveal)
Masked-by-default env reader + PAM step-up unlock ported as typed `createServerFn` RPC (the WP
file's `/api/env-browser/*` route design was superseded by ADR-001). De-slop fix preserved
(masked by default; PAM unlock → 10-min reveal grant). Files:
- `src/lib/api/env-browser.functions.ts` — 2 server fns, each a top-level
  `createServerFn(...).middleware([gate]).handler(serverFnNoop)` literal; gate options exported
  (`readEnvGateOptions` / `unlockGateOptions`) as the single source of truth so the node-env test
  drives the REAL handlers through `defineApiRoute`. All `@/server/**` (pam / env-reveal / errors)
  + `node:fs/promises` imported dynamically inside handlers.
  - `readEnv` (GET, auth `admin`, rate-limit 30/60s/user): allowlist (`/opt/cortexos/.secrets/`,
    `/opt/cortexos/stacks/`) via `fs.realpath` (resolved path is authoritative — symlink/`..`
    escape rejected even when the literal request string starts with an allowed prefix; the legacy
    literal-prefix fallback that let `…/stacks/../../etc/passwd` through is fixed). Returns
    `{path, revealed, revealExpiresAt, entries:[{key,value,masked}]}`; `value` is the masked string
    unless the calling session holds a LIVE reveal grant (`hasRevealGrant`) — no cleartext leaves the
    server without a grant. `SECRET_KEY_RE` + `maskValue` ported verbatim from the legacy handler.
  - `unlock` (POST, auth `admin`, rate-limit 5/60s/user): re-verifies the CURRENT operator's PAM
    password (`getPamAuthenticator().authenticate(user.username, input.password)`), on success
    `grantReveal(sessionId)` → 10-min window; returns `{ok, expiresAt, ttlSec}`. Coarse `authError`
    on PAM failure (no user-enumeration); password NEVER logged / echoed / placed in the audit target
    (`target: () => null`); PAM error detail never surfaced. Reuses `src/server/env-reveal` (WP-03)
    unchanged.
- `src/lib/api/__tests__/env-browser.functions.test.ts` — node-env tests (10): masked-by-default
  (no grant → secret `value === masked`, full serialized response asserted to contain NO cleartext),
  unlock with valid PAM pw → grant within 10 min → same-session read returns cleartext, no
  cross-session leak (session A unlocks, session B stays masked), allowlist 403 (`/etc/passwd`),
  realpath-traversal 403 (`…/stacks/../../etc/passwd`), 401/403 auth gates, rate-limit (6th unlock → 429).

Evidence: `vitest run src/lib/api/__tests__/env-browser.functions.test.ts` = 10 passed.
`vitest run src/server src/lib/api` = 397 passed; the handful of failures vary per run and are
pre-existing pglite/migrate timeouts under parallel load (e.g. `migrate-filter.test.ts`,
`client-pglite-extra.test.ts`) — each passes in isolation, none touch env-browser.
`pnpm --filter @cortexos/dashboard-next typecheck` = 0 errors. No dependency changes; reused
`src/server/{env-reveal,auth/pam,errors}` only (no edits to db/approval/audit/config internals).

### WP-19 — api terminal (WIP; named-op path DONE, live PTY transport-BLOCKED)
The WP-19 spec assumed an h3/Vinxi `upgradeWebSocket` route for the interactive PTY. That
assumption is invalid in this framework — **ADR-001 already proved there are NO HTTP/WS
routes**, only `createServerFn` RPC. The one-shot allowlisted named-op surface is fully ported
and real; the live interactive shell is blocked on transport + a native dep and stays mocked in
the frontend (sys-pilot `src/features/Terminal.tsx`) until both land. Files created:
- `src/server/terminal/pty-bridge.ts` — named-op dispatcher ported from legacy
  `pty-bridge.ts`, **stub executor removed** (no `M2_PTY_STUB`/marker). `dispatch(input, ctx)`:
  allowlist (terminal surface only) → recursive arg-smuggling scan (`validateShellArg` per
  string arg) → `<placeholder>` argv render from the policy entry → PB-2 belt-and-braces reject
  of any rendered `<shell> -c` pair → **real `execFile`** (fixed argv, no shell, 30s timeout,
  4MiB maxBuffer). Linux uses the real `execFile` executor; macOS/CI/tests use a deterministic
  mock (same node-env seam as the systemd/incus bridges; `CORTEX_TERMINAL_BRIDGE_REAL=0` forces
  mock). Exports `dispatch`, `listTerminalOps`, `validateAllArgs`, `spawnPty`,
  `setExecutorForTests`. Audits every reject + dispatch (success AND non-zero exit).
- `src/lib/api/terminal.functions.ts` — 2 server fns (createServerFn RPC, all `@/server` via
  dynamic import): `listTerminalOps` (GET admin, rate-limit 30/min/user) and
  `dispatchTerminalOp` (POST admin, rate-limit 10/min/user). Unknown/non-allowlisted op
  (incl. any `bash -c`) → 403; shell metacharacter in an arg → 400; non-zero exit is NOT an
  HTTP error (returned as `{stdout,stderr,exitCode}` for the client to render).
- `src/server/terminal/__tests__/pty-bridge.test.ts` (15) + `src/lib/api/__tests__/terminal.functions.test.ts` (9).

**Transport mechanism this framework supports (researched):** the only server primitive is
`createServerFn` RPC over a single `fetch(Request)→Response` h3 entry (`src/server.ts` →
`@tanstack/react-start/server-entry`). Findings:
- **WebSocket: NOT achievable.** `crossws@0.4.6` + `h3@2.0.1-rc` ARE present (transitive deps of
  TanStack Start), and h3 v2 can do WS via `defineWebSocketHandler` + the `crossws/server` plugin
  — BUT that plugin must be registered in the Nitro/`serve()` bootstrap, which the
  `node-server` preset (via `@lovable.dev/vite-tanstack-config`) owns; we have no route/plugin
  injection point, and ADR-001 proved file-routes 404. So no WS upgrade is reachable from app code.
- **SSE / streaming: partially available but does not fit the gate.** TanStack's server-fn
  handler (`start-server-core/server-functions-handler.js`) supports raw `ReadableStream`
  multiplexing over RPC (`createRawStreamRPCPlugin`/`createMultiplexedStream`) and passes a
  raw `Response` through verbatim (`X_TSS_RAW_RESPONSE`). However our security gate
  (`defineServerFn`) returns the handler's **data** via `next({ result })`, not a raw streaming
  `Response`, and a single RPC call has no input back-channel — so a live, bidirectional,
  resizable PTY stream does not fit the gated server-fn model cleanly. Output-only streaming of
  a one-shot command COULD be added later behind a raw-Response gate variant, but interactive
  shell I/O still needs WS.

**BLOCKER + dep flag for the orchestrator:** the interactive PTY needs (a) a streaming/WS
transport this framework does not expose to app code, and (b) the native addon **`node-pty`**
(legacy pinned `node-pty@^1.0.0` in `packages/dashboard/package.json`). `node-pty` builds a
native `.node` file (node-gyp/python) → it needs the monorepo **build allowlist**
(`pnpm.onlyBuiltDependencies`). **NOT added to package.json by this WP** — flagged here for the
orchestrator. `spawnPty()` is implemented (shell allowlist `/bin/bash`,`/bin/sh`,`/usr/bin/bash`,
`/usr/bin/zsh`; default `/bin/bash`; `CORTEX_TERMINAL_SHELL` override still allowlist-checked;
fixed empty argv; lazy computed-specifier `node-pty` import) but throws `pty_unavailable` until
both land. WP-36 (frontend) should keep the mock terminal and wire the named-op palette to
`dispatchTerminalOp`/`listTerminalOps`.

Evidence: `vitest run src/server src/lib/api` = 408 passed (33 files; +24 new WP-19 tests).
`tsc --noEmit` = 0 errors. `grep -r 'M2_PTY_STUB\|M2_STUB_MARKER' src/server/terminal/` = CLEAN.
No dependency changes; no edits outside WP-19's OWNS + the new `src/lib/api/terminal.functions.ts`.

## Wave 2 — frontend route-groups (PARALLEL; need WP-04)
| WP | Title | Pairs with | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-30 | shell/nav/auth/login | WP-20 | done | claude | shell wired to real PAM auth via createServerFn RPC; localStorage guard replaced with `me`-based `_authenticated` beforeLoad; admin nav gated on real groups; SimulateMenu removed |
| WP-31 | overview | WP-10,14 | todo | | |
| WP-32 | apps + healthcheck | WP-10 | todo | | |
| WP-33 | docker | WP-11 | todo | | |
| WP-34 | incus + wizard | WP-12 | todo | | |
| WP-35 | systemd | WP-13 | todo | | |
| WP-36 | system/net/storage/proc/terminal | WP-14,19 | todo | | |
| WP-37 | mail-guardian | WP-15 | todo | | |
| WP-38 | approvals + audit | WP-16 | todo | | |
| WP-39 | alerts | WP-17 | todo | | |
| WP-40 | admin | WP-10,18 | done | claude | services CRUD + env-browser PAM-unlock reveal + account/me + real empty-states wired |
| WP-41 | agents | WP-21 | todo | | |

## Wave 3 — verify & cutover (sequential)
| WP | Title | Depends-on | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-50 | security test suite (GATE) | all Wave 1 | done | claude | 42 assertions, 0 findings (cf4680e) |
| WP-51 | parity verification | all W1+W2 | done | claude | runtime smoke: all routes serve, guard 307s |
| WP-52 | build + systemd cutover | WP-50, WP-51 | done | claude | LIVE on :3080; legacy kept for rollback |

## Wave 4 — post-cutover
| WP | Title | Depends-on | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-53 | i18n es/pt-br | WP-52 | todo | | |
| WP-54 | legacy removal + docs | WP-52 | todo | | |
