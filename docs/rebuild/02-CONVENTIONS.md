# Conventions (shared rules for every work package)

> The contract (`01`) says *what* the API is. This says *how* we build it consistently so
> parallel agents produce a coherent app. Defer to the legacy implementation in
> `packages/dashboard/src/lib/server/**` for exact behavior.

## Directory layout (`packages/dashboard-next`)

```
src/
  routes/
    <page routes>            sys-pilot UI routes (keep 1-1; only swap data source)
    api/<domain>/...         server API routes (one folder per backend domain WP)
  server/                    PORTED BACKEND (new) — framework-agnostic Node/TS
    db/                      client.ts, schema.ts, repos/*, migrate
    auth/                    pam.ts, session-store.ts, cookies.ts, csrf.ts, rbac
    health/                  scheduler.ts (+ probe)
    incus/  docker/  system/ bridges (execFile readers/dispatchers)
    mail-guardian/           repo + classifier wiring
    approval/ audit/ env-reveal.ts  policy.ts rate-limit.ts redact.ts errors/
    define-api-route.ts      the request wrapper (Wave 0)
    runtime.ts               server-boot hooks (health scheduler start, etc.)
  lib/api/                   FRONTEND api client (replaces mocks/api.ts seam)
  lib/adapters/              map @cortexos/contracts shapes -> sys-pilot component props
  mocks/api.ts               legacy seam — being deleted/redirected in Wave 2
migrations/                  ported from legacy (same files, same order)
```

## Server primitive: `defineApiRoute` (Wave 0, WP-01)

Mirrors legacy `route-helper.defineRoute`. Every `/api/*` handler uses it. Signature:
```ts
export const Route = defineApiRoute({
  methods: ['POST'],
  auth: 'admin',                 // 'public'|'any'|'admin'|GroupName
  input: ZodSchema,              // optional; validated -> 400 on failure
  rateLimit: { limit, windowSec, bucket: 'ip'|'user' },
  surface: 'docker', action: 'docker.action',
  target: (input, ctx) => string|null,   // for audit
  approval: true,                // optional: require + consume an approval token
  handler: async ({ input, user, ctx }) => result,  // throw typed errors from errors/
})
```
It must: resolve session, enforce auth/RBAC, CSRF-check non-GET, rate-limit, validate input,
optionally consume approval token, run handler, append audit row, and serialize the success
or typed-error envelope (`01-API-CONTRACT.md`). Implement once; all domains reuse it.

## Auth model (Wave 0, WP-01/WP-20) — security-critical

Port from legacy `src/lib/server/auth/*` + `hooks.server.ts`:
- **PAM login:** `authenticate-pam` (Linux, in-process; server runs as root). Never store or
  log passwords. Coarse failure only (no user-enumeration).
- **Session:** DB-backed store (`admin_sessions`/`pam_users`); rolling 30d expiry; resolved
  on every request from the `cortexos_session` cookie into request context (`ctx.user`,
  `ctx.session`). Re-validate RBAC group membership every 60s (TTL).
- **CSRF:** double-submit — `cortexos_csrf` cookie mirrored in `x-csrf-token` header; checked
  on all non-GET. Frontend sends it on every mutation (see client section).
- **RBAC:** `cortexos-admin` is the only admin-bearing group (never trust sudo/wheel).
- **Approval tokens:** HMAC-SHA256, action-hash + session bound, single-use, TTL (60s
  destructive / 300s reveal). Mint via `/api/approvals`; `consume()` at the destructive
  endpoint. Pure crypto — port `approval/index.ts` verbatim.
- **Env-browser reveal:** masked by default; `POST /unlock` does PAM re-auth → 10-min
  per-session grant (`env-reveal.ts`); GET returns cleartext only while the grant is live.
  401/403 from a probed service ≠ secret leak; never weaken this gate.

## Health scheduler boot

Port `server/health/scheduler.ts`. Start it **once** at server boot via `server/runtime.ts`
(Nitro server plugin / TanStack start handler), not per-request. Immediate sweep + 60s interval.

## Frontend data-fetching pattern (Wave 2)

- sys-pilot fetches via a mock layer at `src/mocks/api.ts`. **Replace it with `src/lib/api/`**
  — a typed client (fetch + react-query) hitting the real `/api/*`. Keep the *same function
  signatures* sys-pilot already calls so page components don't change shape.
- Every mutation sends `x-csrf-token` (read from the csrf cookie / session).
- Map server entities → component props in `src/lib/adapters/` (do not change component
  prop shapes; adapt to them). Reuse `@cortexos/contracts`.
- **Loading/empty/error states:** use sys-pilot's existing skeletons/EmptyState. For routes
  with no backend, render a real empty-state — **never fabricated data**.
- Auth: real login page → `POST /api/auth/login`; the `_authenticated` guard checks
  `GET /api/auth/me`; admin-only UI gated on `user` group membership.

## Coding standards

- TypeScript strict. Validate all input with zod. No `any` at boundaries.
- Never log secrets/passwords/tokens. Never put secret values in audit `target`.
- Host-privileged ops via `execFile` (fixed argv, no shell), allowlisted args — copy the
  legacy `policy.ts` allowlists.
- Match sys-pilot's existing code style in `src/` (React/TSX); match legacy style in `server/`.

## Definition of Done (per WP)

1. Code complete per the WP's acceptance criteria.
2. `pnpm --filter @cortexos/dashboard-next build` passes (or `pnpm --filter ... typecheck` if
   build is gated by another WP), and any WP-specific tests pass.
3. No edits outside the WP's OWNED paths.
4. For backend WPs: endpoint matches `01-API-CONTRACT.md` exactly (shape + auth + errors).
5. For frontend WPs: route renders against the real client with loading/empty/error states;
   UI unchanged vs sys-pilot.
6. Update `STATUS.md` (one line). Note any contract change in `01` + flag dependents.

## File-ownership / no-collision rule

Each WP in `03-WORK-BREAKDOWN.md` lists OWNED paths. Agents edit only those. Shared files
(`define-api-route.ts`, `server/auth/*`, `db/schema.ts`, `lib/api/index.ts`, router
registration) are owned by **Wave 0** WPs; later WPs ADD files in their own subfolders and
register via the established extension points — they never edit a shared file's existing code.
