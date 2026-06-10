# WP-32 — UI: Apps + Healthcheck
- **Wave:** 2   **Depends-on:** WP-04, WP-10 (final wiring)   **Parallel-safe-with:** WP-30, WP-31, WP-33–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.apps.tsx`
  - `src/routes/_authenticated.healthcheck.tsx`
  - `src/features/Apps.tsx`
  - `src/features/Healthcheck.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Apps page (service catalogue grid/list) and the Healthcheck page (probe table + incident timeline) to real data from `GET /api/services` and `GET /api/services/:id/health`. Replace all `api.services`, `api.healthcheckList`, `api.alerts.history` mock calls with the WP-04 typed client. The "recheck" action (`POST /api/services/:id/health`) must send CSRF token and be admin-gated. Visual layout stays 1-1.

## Read first

- `src/features/Apps.tsx` — calls `api.services` (queryFn) and `api.services` for category filter; no pagination (client-side filter)
- `src/features/Healthcheck.tsx` — calls `api.services` + `api.healthcheckList` (server paginated DataTable) + `api.alerts.history` (incident timeline); recheck button calls `qc.setQueryData` mock
- `src/mocks/api.ts` — `api.services`, `api.healthcheckList`, `api.alerts.history`
- `01-API-CONTRACT.md` §Services: `GET /api/services?activeOnly=true&page=0&pageSize=200` → `{rows: Service[], total}`; `POST /api/services/:id/health` → `{snapshot}` (admin, recheck)
- `01-API-CONTRACT.md` §Alerts: `GET /api/alerts/history` → `{history}`
- `src/lib/api/` (WP-04) — typed client functions
- `src/lib/adapters/` (WP-04) — `Service` from `@cortexos/contracts` → component prop shape
- Legacy reference: `packages/dashboard/src/routes/(authed)/apps/+page.server.ts`, `packages/dashboard/src/routes/(authed)/healthcheck/+page.server.ts`

## Steps

1. **Apps page — replace `api.services`.**
   - Swap `queryFn: api.services` for `queryFn: () => apiClient.services({ activeOnly: true, pageSize: 200 })` then extract `data.rows`.
   - Client-side category filter, search, and status filter continue to operate on the in-memory array — no change to filter logic.
   - `useFavorites` hook uses localStorage — no change needed.
   - Adapt `Service` from contracts to the shape expected by `<StatusBadge>` and `<TechIcon>` using `src/lib/adapters/services.ts`.

2. **Healthcheck page — replace `api.healthcheckList`.**
   - The DataTable `server` prop uses `api.healthcheckList` for server-side pagination/search/sort. Replace with a real paginated fetch: `apiClient.services({ q, page, pageSize, sortKey, sortDir })`.
   - Map the `{rows, total}` response to the `ListResult<T>` shape that `DataTable` expects (WP-04 should expose this wrapper).

3. **Healthcheck page — replace alert history.**
   - `api.alerts.history` (incident timeline) → `apiClient.alerts.history()`. Extract `data.history`.
   - The incident timeline `<ol>` renders the last 12 events — keep slice logic unchanged.

4. **Recheck action — wire real POST.**
   - Current mock: `qc.setQueryData` to fake a response time update.
   - Real: `POST /api/services/:id/health` with `{source: "manual"}` body and `x-csrf-token` header (via WP-04 client). On success, invalidate `["services"]` and `["healthcheck"]` query keys so the table refetches.
   - Gate behind `user.is_admin` check — the recheck button is already admin-only in the UI; keep that gate, just wire the real call.
   - Show `toast.error` on API error with the error envelope `message`.

5. **Loading / empty states.**
   - While loading, Apps renders 8 skeleton Cards (already present); Healthcheck renders the DataTable skeleton. Keep existing patterns.
   - If `GET /api/services` returns zero rows, render `<EmptyState>` with "No services registered." (real empty-state, not mock data).

## Acceptance criteria

- [ ] Apps page lists real services from `GET /api/services`; category chips built from real data
- [ ] Healthcheck DataTable paginates via real `GET /api/services` paginated endpoint
- [ ] Recheck button calls `POST /api/services/:id/health`, invalidates query, shows toast
- [ ] Incident timeline shows real alert history from `GET /api/alerts/history`
- [ ] Favorites (localStorage) still work
- [ ] No mock seed data in production
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
# Dev: /apps — verify real service names/statuses appear
# Dev: /healthcheck — verify table loads, recheck button triggers POST
curl http://localhost:3080/api/services?activeOnly=true -b <session>
curl -X POST http://localhost:3080/api/services/<id>/health \
  -H "x-csrf-token: <csrf>" -H "Content-Type: application/json" \
  -d '{"source":"manual"}' -b <session>
```

## Notes / gotchas

- `api.healthcheckList` in the mock uses `live.services()` — same data as `api.services` but paginated. The real endpoint is the same `GET /api/services` with pagination params; there is no separate `/api/healthcheck` endpoint.
- The `Service` contracts type uses `status: ServiceStatus` enum (`"online"|"offline"|"degraded"|"unknown"`). `StatusBadge` and `StatusBadge compact` already map these — just ensure the adapter passes the enum value through unchanged.
- `POST /api/services/:id/health` requires `admin` auth. If the current user is not admin, hide the recheck button (already done via `isAdmin` guard — confirm it reads from the real `useAuth()` user).
- `refetchInterval: 3000` on services query is already set in `Apps.tsx`; keep it.
