# WP-04 — Frontend api-client + adapters
- **Wave:** 0   **Depends-on:** none (contract only — `01-API-CONTRACT.md`)   **Parallel-safe-with:** WP-00, WP-02, WP-03
- **Owns (edit only these):** `packages/dashboard-next/src/lib/api/**`, `packages/dashboard-next/src/lib/adapters/**`, and the **redirect plan** for `packages/dashboard-next/src/mocks/api.ts` (document it in `src/lib/api/README.md`; do NOT delete or rewrite `mocks/api.ts` — Wave 2 swaps consumers).
- **Do NOT touch:** `src/mocks/{api,seed,drift,types}.ts` bodies, `src/features/**`, `src/routes/**`, `src/components/**`, any `src/server/**` (backend WPs). You build the client + adapters and the swap plan only.

## Objective
Build a typed `fetch` + react-query client under `src/lib/api/` that hits the real `/api/*` endpoints, with CSRF-header injection on every mutation and typed error-envelope handling, exposing the SAME function shapes sys-pilot's `src/mocks/api.ts` already calls so Wave-2 page components swap their data source without changing call sites. Plus adapter scaffolding mapping `@cortexos/contracts` entities → sys-pilot component prop shapes. Done = client compiles, one demo call (`GET /api/auth/me`) works end-to-end against a dev server, and the mock-seam swap mechanism is documented.

## Read first
- `packages/dashboard-next/src/mocks/api.ts` — the EXACT surface to mirror. The default export is `const api = { ... }` with these members (signatures must match so Wave-2 callers are drop-in):
  - top-level async getters: `system()`, `processes()`, `network()`, `services()`, `history()`, `incus()`, `systemd()`, `approvals()`, `audit()`, `users()`, `projects()`, `agents()`, `mail()`, `notifications()`, `envFiles()`, `badges()`, `backups()`, `scheduler()`.
  - nested groups: `docker.{containers,images,volumes,containersList,imagesList,volumesList}`, `alerts.{rules,history,rulesList,historyList}`.
  - paginated list endpoints taking `(p?: ListParams)` and returning `ListResult<T>`: `incusList, systemdList, auditList, usersList, projectsList, mailList, badgesList, backupsList, schedulerList, drivesList, healthcheckList, servicesList`.
  - shared types (re-export or mirror): `SortDir`, `ListParams` (`{q?,page?,pageSize?,sortKey?,sortDir?}`), `ListResult<T>` (`{rows,total,page,pageSize}`).
- How callers use it (so signatures stay drop-in): `src/features/*.tsx`, e.g. `useQuery({ queryKey:["approvals"], queryFn: api.approvals })`, `useQuery({ queryKey:["services"], queryFn: api.services, refetchInterval:3000 })`, and `DataTable server={{ queryKey, fetch: api.incusList }}` — the `fetch` prop is called with `ListParams`. Mirror these call shapes exactly.
- `01-API-CONTRACT.md` — the endpoint catalog (paths, methods, auth, input query params, output shapes) each client function maps to; the §Response envelope (success = raw payload; error = `{code,message,details?,retryAfter?,action?,ttlSec?}` with statuses validation→400 / auth→401 / permission→403 / not_found→404 / rate_limit→429 / approval_required→412 / system→500); §Transport (same-origin, `cortexos_session` cookie, `x-csrf-token` header echoing the `cortexos_csrf` cookie on all non-GET).
- `02-CONVENTIONS.md` §"Frontend data-fetching pattern": replace `mocks/api.ts` with `src/lib/api/`; every mutation sends `x-csrf-token`; map entities→props in `src/lib/adapters/`; never fabricate data (real empty-state for missing backends); auth via `POST /api/auth/login`, guard via `GET /api/auth/me`.
- `packages/dashboard-next/src/lib/api/example.functions.ts` — existing `createServerFn` example (a different pattern; the real client here is plain browser `fetch` to `/api/*`, NOT server fns).
- `packages/dashboard-next/src/lib/config.server.ts` — note `VITE_*` is the only client-readable env; the CSRF cookie name `cortexos_csrf` is read from `document.cookie` client-side (it is NOT HttpOnly by design — see WP-01 `cookies.ts`).
- `packages/contracts/src/entities/*` — the source types for adapters (`Service`, `ServiceStatus`, `IncusInstance`, `Alert`, `AuditEvent`, `ApprovalToken`, `User`, `Session`, mail_guardian types). sys-pilot's row shapes live in `src/mocks/types.ts` and `src/mocks/seed.ts` — adapters map contracts → those shapes.

## Steps
1. Create `src/lib/api/http.ts`: a typed `request<T>(method, path, { query?, body?, signal? })` over `fetch` with `credentials: 'same-origin'`. For non-GET, read the `cortexos_csrf` cookie from `document.cookie` and set the `x-csrf-token` header. Parse JSON; on non-2xx, parse the error envelope into a typed `ApiClientError` (carrying `code`, `message`, `details`, `retryAfter`, `action`, `ttlSec`, `status`). For `approval_required` (412) surface `action`/`ttlSec` so the UI can drive the approvals flow.
2. Create `src/lib/api/client.ts` exporting an `api` object with the SAME member names/shapes as `mocks/api.ts`, each implemented as a real call. Examples:
   - `services: () => request<Service[]>('GET','/api/services').then(r => r.rows ?? r)` — match the contract output (`GET /api/services` returns `{rows,total}`; adapt to the mock's array return where callers expect an array, OR keep `{rows,total}` and have the adapter unwrap — pick per call site and document).
   - `servicesList: (p?: ListParams) => request<ListResult<...>>('GET','/api/services',{ query: toQuery(p) })` mapping `ListParams` → contract query (`category,kind,status,activeOnly,page,pageSize`).
   - `docker.containers/images/volumes` → `/api/docker/{containers,images,volumes}` returning `{items}`.
   - `incus()` → `/api/incus/instances` `{items}`; `systemd()` etc.
   Re-export `SortDir`, `ListParams`, `ListResult<T>` from here (mirror the mock's definitions).
3. For endpoints with NO backend yet (e.g. `notifications`, `backups`, `scheduler`, `projects`, `badges` may lack a Wave-1 domain), return a real empty result (`[]` / `{rows:[],total:0,...}`) — NEVER seed/mock data. Document which endpoints are empty-until-backend.
4. Create `src/lib/adapters/` with one module per entity family (`services.ts`, `incus.ts`, `alerts.ts`, `audit.ts`, `approvals.ts`, `users.ts`, `mail.ts`), each exporting pure functions `toServiceRow(s: Service): <mock row shape>` etc. Do NOT change component prop shapes — adapt contracts to them. Scaffold the obvious ones (services, incus, audit) fully; stub the rest with a typed signature + TODO.
5. Add `src/lib/api/auth.ts`: `login({username,password})` → `POST /api/auth/login` (bootstrap CSRF flow per WP-20/legacy login), `logout()` → `POST /api/auth/logout`, `me()` → `GET /api/auth/me` returning `{user,session}`. `me()` is the demo call for the acceptance gate and the Wave-2 `_authenticated` guard.
6. Write `src/lib/api/README.md` documenting the swap mechanism: Wave-2 WPs change a feature's import from `@/mocks/api` to `@/lib/api/client` (same `api` shape) — no call-site edits. List the function-by-function mapping and the empty-until-backend endpoints. Do NOT modify `mocks/api.ts` in this WP.

## Acceptance criteria
- [ ] Client compiles under TS strict; `api` exposes every member of `mocks/api.ts` with compatible signatures (`ListParams`/`ListResult<T>` preserved).
- [ ] Every non-GET request injects the `x-csrf-token` header from the `cortexos_csrf` cookie.
- [ ] Error envelopes are parsed into a typed `ApiClientError` with the right `code`/`status`/`retryAfter`/`action`/`ttlSec`.
- [ ] `api.auth.me()` (GET `/api/auth/me`) works end-to-end against a dev/built server (returns `{user,session}` when logged in, 401 → typed error otherwise).
- [ ] Adapters map `@cortexos/contracts` → sys-pilot prop shapes without changing component props; no fabricated data (empty-state for missing backends).
- [ ] Mock-seam swap mechanism documented; `mocks/api.ts` left untouched.
- [ ] no edits outside OWNS.

## Verification commands
```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next test -- lib/api adapters
# Demo end-to-end (after WP-00 build + WP-01/WP-20 wired, or against the running app):
curl -i http://127.0.0.1:3080/api/auth/me            # 401 unauth → typed error envelope
# (logged-in browser session returns {user,session})
```

## Notes / gotchas
- This WP needs ONLY the contract; it can land before any backend domain exists. Endpoints without a backend return real empty results — the golden rule is never fabricate data.
- The CSRF cookie `cortexos_csrf` is intentionally readable from JS (not HttpOnly) — that's the double-submit design. The session cookie `cortexos_session` is HttpOnly and sent automatically by the browser; do NOT try to read it client-side.
- Keep the `api` object SHAPE identical to the mock so Wave-2 is a one-line import swap. Where the contract's output differs from the mock's (e.g. `{rows,total}` vs a bare array), normalize inside the client function or in an adapter — document the choice; don't push the difference onto call sites.
- Use `credentials: 'same-origin'` so cookies are sent; the app is same-origin with `/api/*`.
- Do not introduce a heavy client abstraction or a generated SDK — a thin `request<T>` + the `api` object is the whole job.
- React-query keys: keep the queryKeys the features already use (`["services"]`, `["approvals"]`, `["alerts","history"]`, etc.) so cache behavior and `refetchInterval` usage are unchanged when consumers swap.
