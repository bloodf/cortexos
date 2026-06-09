# ADR-001 — Server transport: createServerFn RPC, not REST `/api/*`

**Status:** Accepted (supersedes the REST framing in `01-API-CONTRACT.md` + `02-CONVENTIONS.md`).
**Date:** 2026-06-09. **Discovered during:** WP-01/WP-04 verification.

## Context / what we proved

The rebuild kit assumed CortexOS would expose REST `/api/*` HTTP endpoints (a fetch client on
the frontend, file-based server routes on the backend). Empirically, in the vendored template's
framework version this does **not** work:

- `@tanstack/react-start@1.168.25` is the ONLY start package installed. Its exports are
  RPC-oriented (`./server-rpc`, `./client-rpc`, `./ssr-rpc`); there is **no
  `createServerFileRoute` / HTTP file-route mechanism** and no runtime that honors a route's
  `server.handlers` option (a `/api/_ping` route with `server.handlers` compiles + registers in
  `routeTree.gen.ts` but returns **404** at runtime).
- The ONLY server primitive is **`createServerFn`** (RPC), as used by the template's
  `src/lib/api/example.functions.ts`.
- `createServerFn` handlers run **only inside the server runtime** (loaders/SSR/RPC) — a direct
  unit call throws `No Start context found in AsyncLocalStorage`.
- `import-protection` denies any client-reachable file (routes, `start.ts`) from importing
  `**/server/**`. So server-fn definitions must live OUTSIDE `src/server/`, with server-only
  logic imported **dynamically inside** the handler (tree-shaken from the client). Proven:
  a `createServerFn` in `src/lib/api/*.functions.ts` whose handler does
  `await import("@/server/db/...")` builds green and the node server serves the page 200.

## Decision

Transport = **typed `createServerFn` RPC**, not REST. Concretely:

- **Server functions** live in `src/lib/api/<domain>.functions.ts` (client-importable). Each is
  `createServerFn({ method }).inputValidator(zod).handler(async ({ data }) => ...)`.
- **Server-only logic** (db repos, bridges, auth, approval, audit) stays in `src/server/**` and
  is imported **dynamically inside** handlers (`await import("@/server/...")`).
- The **frontend calls the server fns directly** (typed) from loaders/components/mutations —
  there is no `fetch("/api/...")`. TanStack handles the client↔server RPC bridge + serialization.
- **Auth / RBAC / CSRF / rate-limit / approval / audit** become a **`createServerFn` middleware**
  (`defineServerFn` factory) instead of a `(Request)=>Response` wrapper. The session/cookie/CSRF
  read happens via the server runtime's request context (`getStartContext`/`getWebRequest`), not
  a hand-rolled `resolveContext(request)`. TanStack provides request-scoped CSRF for server fns;
  we still bind to the session token + enforce RBAC + approval inside the middleware.

## What stays (NOT invalidated — already verified)
- WP-00 node-server preset + boot hook (commit `d1d1d44`).
- WP-02 DB port — repos/schema/migrations (167 tests, commit `eaaeec1`).
- WP-03 security cores — approval/audit/pam/env-reveal/config/types (168 tests, commit `2117808`).
- WP-01's **logic** ports: `auth/{cookies,csrf,session-store,rbac}.ts` are reusable; only the
  **wrapper shape** changes (Request→Response  →  createServerFn middleware). `context.ts`
  `resolveContext(request)` is replaced by reading the server runtime request context.

## What must be reworked
- **WP-01** → `src/lib/api/define-server-fn.ts` (`defineServerFn` middleware) + drop the
  `/api/_ping` HTTP route; prove gates via a server-fn + its node-env-callable test harness
  (call through the runtime, not a bare invocation). Status → `wip`.
- **WP-04** → RPC client: thin typed facades over the server fns matching sys-pilot's mock
  signatures (no fetch). Status → `wip`.
- **`01-API-CONTRACT.md`** → reframe each "endpoint" as a server fn `name(input) → output`
  (same shapes, auth levels, error envelope; transport is RPC). Method/path columns become fn
  name + method hint.
- **`02-CONVENTIONS.md`** → replace `defineApiRoute`/`/api/*` sections with `defineServerFn` +
  the `src/lib/api/*.functions.ts` placement rule + dynamic-server-import rule.
- **Wave-1 WP specs (WP-10..21)** → "implement server fns in `src/lib/api/<domain>.functions.ts`"
  (not `/api/<domain>` routes). Reused repos/bridges unchanged.
- **Wave-2 WP specs (WP-30..41)** → call the server fns (not the fetch client).

## Consequences
- Cleaner, framework-idiomatic, fully typed end-to-end; no hand-rolled HTTP layer to fight.
- Loses raw `curl`-ability of `/api/*` (verification shifts to runtime/integration tests +
  driving the UI). The security gate (WP-50) tests the `defineServerFn` middleware directly.
- Fan-out of Waves 1 & 2 is **paused** until WP-01/WP-04 are reworked onto this and re-proven.

## `defineServerFn` usage (Wave-1: copy this) — WP-01 DONE, runtime-proven

`defineServerFn` is in `src/lib/api/define-server-fn.ts`. It returns a TanStack **function
middleware** (the security gate); the server fn literal is written at module top level. This
exact shape is forced by the framework and is **proven on the built node server** (10/10 gates:
authed→200, unauth→401, non-admin→403, admin→200, bad-input→400, CSRF missing/stolen/mismatched
→403, valid session-bound CSRF→201, no-session mutation→401).

```ts
// src/lib/api/<domain>.functions.ts  (client-importable; NEVER static-import src/server here)
import { createServerFn } from '@tanstack/react-start';
import { defineServerFn, serverFnNoop } from '@/lib/api/define-server-fn';
import { z } from 'zod';

const listGate = defineServerFn({
  method: 'GET',                      // 'GET' read · 'POST' mutation (CSRF-enforced)
  auth: 'any',                        // 'public' | 'any' | 'admin' | GroupName
  input: z.object({ q: z.string().optional() }),
  surface: 'services',
  action: 'services.list',
  handler: async ({ input, user, ctx }) => {
    const { listServices } = await import('@/server/services/repo');  // DYNAMIC import
    return listServices(input.q);
  },
});
export const listServices = createServerFn({ method: 'GET' })
  .middleware([listGate])
  .handler(serverFnNoop);

// destructive op: require a single-use approval token + admin
const deleteGate = defineServerFn({
  method: 'POST',
  auth: 'admin',
  approval: true,
  input: z.object({ id: z.string() }),
  surface: 'services',
  action: 'services.delete',
  target: (input) => input.id,        // audit target (never a secret)
  handler: async ({ input }) => {
    const { deleteService } = await import('@/server/services/repo');
    return deleteService(input.id);
  },
});
export const deleteService = createServerFn({ method: 'POST' })
  .middleware([deleteGate])
  .handler(serverFnNoop);
```

Hard rules (do NOT deviate — each was empirically required):
1. `defineServerFn(opts)` returns a middleware; the `createServerFn(...).middleware([gate])
   .handler(serverFnNoop)` literal MUST be at module top level (the compiler errors with
   "createServerFn must be assigned to a variable!" otherwise, and a factory-returned handler
   leaks `src/server` into the client bundle → import-protection denial).
2. Import server-only modules **dynamically inside the handler** (`await import('@/server/...')`).
   Never static-import `src/server/**` (or `@tanstack/react-start/server`) at the top of a
   client-reachable `*.functions.ts` file.
3. The handler runs inside the extracted gate, so its dynamic server imports are server-only.
   The top-level `.handler(serverFnNoop)` is a passthrough; the gate sets the result.
4. Frontend calls it typed: `await listServices({ data: { q } })` from loaders/components —
   no `fetch`. Mutations must send the session-bound CSRF (cookie + `x-csrf-token` header).
5. Throw typed `ApiError`s from `@/server/errors` inside the handler; the pipeline maps them
   to the contract envelope + HTTP status. Audit runs on success AND failure automatically.

Pipeline order (gate → `server-fn-runner.server.ts` → `server-fn-pipeline.ts` `defineApiRoute`):
resolveContext → method → input(400) → auth/RBAC(401/403) → CSRF on mutations(403/401) →
rate-limit(429) → approval(412) → handler → audit → success/typed-error envelope.
