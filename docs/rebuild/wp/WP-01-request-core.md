# WP-01 — Request core (defineApiRoute + auth/session/CSRF/RBAC)
- **Wave:** 0   **Depends-on:** WP-02 (DB), WP-03 (security cores)   **Parallel-safe-with:** WP-04
- **Owns (edit only these):** `packages/dashboard-next/src/server/define-api-route.ts`, `packages/dashboard-next/src/server/auth/{session-store,cookies,csrf,rbac}.ts`, `packages/dashboard-next/src/server/context.ts`, and a demo route `src/routes/api/_ping/*` + its test (for the acceptance gate only).
- **Do NOT touch:** `src/server/auth/pam.ts` (WP-03), `src/server/{approval,audit,policy,rate-limit,errors,config,env-reveal}` (WP-03), `src/server/db/**` (WP-02), `vite.config.ts` (WP-00). Wave-1 domain routes are NOT yours — you only ship `_ping` as the proof.

## Objective
Rewrite the SvelteKit request glue for TanStack Start: resolve the session cookie into a request `ctx` (user/session/groups/isAdmin), issue/verify session + CSRF cookies, enforce RBAC, and provide the single `defineApiRoute` wrapper every `/api/*` handler uses (auth → CSRF → rate-limit → input validation → optional approval consume → handler → audit → typed-error/success envelope). Done = a trivial protected `GET/POST /api/_ping` returns 200 authed, 401 unauth, 403 non-admin, 400 on bad input, and CSRF is enforced on POST.

## Read first
- `packages/dashboard/src/lib/server/route-helper.ts` — the legacy `defineRoute(opts)`. PRESERVE this pipeline order: (1) method match → 405; (2) input parse+validate (GET/DELETE from querystring, POST/PUT/PATCH from JSON or formData) → 400 with field `details`; (3) auth gate (`'any'|'admin'|GroupName`); (4) CSRF on non-GET/HEAD/OPTIONS against `session.csrfToken`; (5) rate-limit (`bucket: 'ip'|'user'`, key `ip:<ip>:<route>` or `user:<id>:<route>`); (6) handler; (7) `safeAudit` on BOTH success and failure (never let audit throw). Note `RouteOptions` fields: `methods, input?, auth, rateLimit?, surface, action, target?, handler`. `02-CONVENTIONS.md` adds `approval?: true` (consume an approval token).
- `packages/dashboard/src/hooks.server.ts` — the per-request lifecycle to port into a TanStack request middleware / `ctx` resolver: reset locals + `requestId`; read `cortexos_session` cookie → `getSessionStore().resolveByToken()`; drop stale token (clear cookie); re-validate RBAC role if `lastRoleCheckAt` older than `ROLE_CHECK_TTL_MS = 60_000` via `pam.isAdmin()` + `store.revalidateRole()`; touch rolling expiry (`DEFAULT_SESSION_TTL_MS = 30d`) + re-issue cookie; populate `ctx.user`/`ctx.session`; apply `FRAMEWORK_HEADERS` (`X-Content-Type-Options:nosniff, X-Frame-Options:DENY, Referrer-Policy:strict-origin-when-cross-origin, Permissions-Policy:camera=(),microphone=(),geolocation=()`); probabilistic `gcExpired()` (~1/1000).
- `packages/dashboard/src/lib/server/auth/index.ts` — `requireAuth/requireAdmin/requireGroup`, `isAdmin(user)` (true iff member of `cortexos-admin`), `hasGroup`, `getCurrentSession`, `requireAuthAsync` (returns full `ResolvedSession`), `clientIp/userAgent`. Port the RBAC predicates verbatim; rewrite the `requireAuth` family to read from the TanStack `ctx` you build (not SvelteKit `event.locals`).
- `packages/dashboard/src/lib/server/auth/session-store.ts` — `SessionStore` interface (`createSession, resolveByToken, touch, deleteByToken, sweepExpired, revalidateRole, gcExpired`), `ResolvedSession`, `CreateSessionInput/Result`, `getSessionStore/setSessionStore/resetSessionStore`, `generateSessionToken`, `DEFAULT_SESSION_TTL_MS`, `InMemorySessionStore`, `DrizzleSessionStore`. Picks Drizzle when `DB_PASSWORD` set, else in-memory. Port verbatim (it depends on WP-02's `db/client` + `db/repos/users`).
- `packages/dashboard/src/lib/server/auth/cookies.ts` — `SESSION_MAX_AGE_SEC`/`CSRF_MAX_AGE_SEC` (30d), `CSRF_HEADER = 'x-csrf-token'`, `CookieJar` interface, `generateCsrfToken`, `setSessionCookie/getSessionCookie/clearSessionCookie` (HttpOnly, SameSite=Lax, Secure in prod), `setCsrfCookie/getCsrfCookie/clearCsrfCookie` (NOT HttpOnly), `safeCsrfEqual` (constant-time). Port verbatim; adapt `CookieJar` to a thin wrapper over TanStack/Web `Request`/`Response` cookies.
- `packages/dashboard/src/lib/server/auth/csrf.ts` — `csrfIsSafeMethod`, `csrfHeadersFromRequest`, `requireCsrf(event, expected, jar?)` (double-submit: header == cookie == session-bound token; constant-time; `missing_session_csrf` surfaces as 401, others 403), `LOGIN_BOOTSTRAP_CSRF = 'login-bootstrap'`. Port; replace the `AuthRequestEvent` shape with your `ctx`/`Request`.
- WP-03 outputs you consume: `errors/{types,index}` (`ApiError`, `jsonError`, `httpStatusFor`, `ApiErrorThrown`), `rate-limit` (`checkRateLimit`), `audit` (`audit`, `AuditInput`), `approval` (`consumeApproval`, `actionHashFor`), `config` (`SESSION_COOKIE`, `CSRF_COOKIE`).
- `01-API-CONTRACT.md` §Transport, §Response envelope, §Auth levels, §Rate limits (defaults: unauth strict 30/min, authed 10/min, admin 30/min). `02-CONVENTIONS.md` §"Server primitive: defineApiRoute" (the exact target signature) + §Auth model.
- `packages/dashboard/src/routes/api/auth/login/+server.ts` — reference for cookie issuance after login + the `x-csrf-token` double-submit + bootstrap flow (WP-20 implements the actual route; you only need the cookie/CSRF mechanics).
- TanStack server-route convention: confirm how `/api/*` server routes are declared in this Router setup. There is NO existing `api/` route yet; `src/lib/api/example.functions.ts` shows `createServerFn`. Determine whether `/api/*` uses file-based server routes (`createServerFileRoute`/`ServerRoute` in `src/routes/api/...`) or a Nitro/h3 handler — inspect the installed `@tanstack/react-start` + `@tanstack/react-router` versions and `routeTree.gen.ts`. `defineApiRoute` must produce a handler compatible with whichever the framework expects (a `(request: Request) => Promise<Response>` core wrapped by the framework's route export).

## Steps
1. Create `src/server/context.ts`: define `RequestCtx` (`user: User|null`, `session: Session|null`, `requestId: string`, `clientIp`, `userAgent`, plus cookie get/set helpers over the Web `Request`/`Response`). Export a `resolveContext(request): Promise<RequestCtx>` that ports the `hooks.server.ts` lifecycle (session resolve, stale-drop, role re-validate at 60s TTL, rolling touch, return ctx + any Set-Cookie headers to apply). Apply `FRAMEWORK_HEADERS` on the way out.
2. Port `cookies.ts` and `csrf.ts` into `src/server/auth/`, swapping the `CookieJar`/`AuthRequestEvent` shapes for thin adapters over Web `Request`/`Headers`/`Response`. Keep `safeCsrfEqual`, the double-submit logic, and `LOGIN_BOOTSTRAP_CSRF` exactly.
3. Port `session-store.ts` into `src/server/auth/session-store.ts` (wire `getDb` + users repo from WP-02). Put the RBAC predicates (`isAdmin`, `hasGroup`, `requireAuth`-family rewritten to read `ctx`) in `src/server/auth/rbac.ts`.
4. Write `src/server/define-api-route.ts` mirroring `02-CONVENTIONS.md`'s signature:
   ```ts
   defineApiRoute({ methods, auth, input?, rateLimit?, surface, action, target?, approval?, handler })
   ```
   Pipeline: resolveContext → method match (405) → input parse/validate (400 + `details`) → auth/RBAC (401/403) → CSRF on non-GET (403; 401 if no session) → rate-limit (429 + retryAfter) → if `approval` consume `x-cortex-approval-token` bound to `actionHashFor(action, input)` + `ctx.session.id` (412 on failure, single-use) → handler → `safeAudit` (never throws) → serialize success (200/201) or `jsonError(ApiError)`. Default rate limits per `01`: unauth 30/min, authed 10/min, admin 30/min.
5. Export the audit `result` mapping from legacy `safeAudit`: `denied` for permission/auth errors, `failure` for other errors, `success` otherwise; never put secret values in `target`.
6. Ship `src/routes/api/_ping` using `defineApiRoute` with `auth:'any'` (and a second `auth:'admin'` variant or a query flag) + a tiny zod input to prove the 400 path. Add a test asserting 200 authed / 401 unauth / 403 non-admin / 400 bad input / 403 missing-CSRF on POST.

## Acceptance criteria
- [ ] `GET /api/_ping` returns 200 with a valid session, 401 without one.
- [ ] An admin-gated ping returns 403 for an authenticated non-admin, 200 for an admin.
- [ ] A `defineApiRoute` with an input schema returns 400 + `{code:'validation', details:[...]}` on bad input.
- [ ] `POST` without a valid `x-csrf-token` (matching cookie + session-bound token) returns 403; with it, passes.
- [ ] Error envelopes + HTTP statuses match `01-API-CONTRACT.md` (incl. approval_required → 412, rate_limit → 429 + Retry-After).
- [ ] Audit row written on both success and failure; audit failure never breaks the request.
- [ ] no edits outside OWNS.

## Verification commands
```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next test -- _ping define-api-route csrf session
# End-to-end against a dev/built server (after WP-00):
curl -i http://127.0.0.1:3080/api/_ping                               # 401 (no session)
curl -i -X POST http://127.0.0.1:3080/api/_ping -d '{}'               # 403 (no CSRF) / 401
```

## Notes / gotchas
- This is security-critical. Do NOT weaken any gate to make a test pass. CSRF is double-submit AND session-bound: a stolen CSRF cookie alone must not pass.
- RBAC: `cortexos-admin` is the only admin group (SR-003). Re-validate role every 60s via PAM (`revalidateRole`) so a demoted admin loses access within a minute.
- `resolveContext` must drop stale/expired tokens silently (clear cookie) and never throw on DB hiccups during touch/gc (best-effort, swallow).
- The legacy `errors/index.ts` SvelteKit `apiError`/`setKitShim` path is gone (WP-03 dropped it). Throw `ApiError` values (or `ApiErrorThrown`) from handlers; the wrapper maps them via `jsonError`/`httpStatusFor`.
- Confirm the TanStack `/api/*` server-route export shape BEFORE finalizing `defineApiRoute`'s return type — the wrapper's job is a `(Request) => Promise<Response>`; the per-route file wraps it in the framework's expected export. Document the chosen convention in `STATUS.md` for Wave-1 WPs.
- `session-store` defaults to the in-memory store when `DB_PASSWORD` is absent (tests) and Drizzle otherwise — keep that fallback so the unit suite runs without a DB.
