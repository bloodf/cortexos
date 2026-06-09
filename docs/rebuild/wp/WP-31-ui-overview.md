# WP-31 — UI: Overview
- **Wave:** 2   **Depends-on:** WP-04, WP-10 (final wiring)   **Parallel-safe-with:** WP-30, WP-32–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.overview.tsx`
  - `src/features/Overview.tsx`
  - `src/features/overview/widgets.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed data, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Overview page's widgets to real data from `GET /api/system` (uptime, load, memory, disk) and `GET /api/services` (service catalogue for the status-hero count). Replace `api.system`, `api.services`, and `api.history` mock calls with the WP-04 typed client. Widget layout/drag/resize/localStorage persistence stays 1-1 with sys-pilot.

## Read first

- `src/features/Overview.tsx` — drag-grid shell; renders `<StatusHero />` and widget specs from `widgets.tsx`
- `src/features/overview/widgets.tsx` — each widget's `render()` calls into mock data via `api.system`, `api.services`, etc.; these are the import sites to replace
- `src/components/StatusHero.tsx` — reads service counts; likely calls `api.services`
- `src/mocks/api.ts` — `api.system`, `api.services`, `api.history` functions being replaced
- `01-API-CONTRACT.md` §System: `GET /api/system → {uptime, load, memory, disk}`
- `01-API-CONTRACT.md` §Services: `GET /api/services → {rows: Service[], total}`
- `src/lib/api/` (WP-04) — `apiClient.system()`, `apiClient.services()`; check exact function names WP-04 exposes
- `src/lib/adapters/` (WP-04) — adapter mapping `@cortexos/contracts` shapes → component props
- Legacy reference: `packages/dashboard/src/routes/(authed)/dashboard/+page.server.ts`

## Steps

1. **Replace `api.system` → real client.**
   - In `widgets.tsx` (and wherever `api.system` is called), swap `queryFn: api.system` for the WP-04 client call: `queryFn: () => apiClient.system()`.
   - Query key stays `["system"]` so existing refetch intervals work.
   - Map the contracts `{uptime, load, memory, disk}` shape through `src/lib/adapters/system.ts` to whatever shape the widget components expect. Do not change widget component props — adapt to them.

2. **Replace `api.services` → real client.**
   - Swap `queryFn: api.services` for `queryFn: () => apiClient.services()` (no pagination params needed for the overview count — fetch all active).
   - `StatusHero` reads online/offline counts from this data; adapt `Service[]` from contracts → component shape.

3. **Replace `api.history` → real client.**
   - `api.history` (alert history used by some widgets) maps to `GET /api/alerts/history`. Swap to `apiClient.alerts.history()`.

4. **Loading and empty states.**
   - While `isLoading`, each widget's `render()` should return the existing skeleton (sys-pilot widgets already have loading patterns — preserve them). Use `src/components/skeletons/` patterns.
   - If `/api/system` returns an error or the backend is not yet live, render the widget's existing empty/error state rather than fabricated data.

5. **Refetch intervals.**
   - `api.system` currently has no explicit interval; add `refetchInterval: 5000` (5 s) to match the live-metrics intent visible in legacy dashboard.
   - `api.services` uses `refetchInterval: 3000` (already set in `AppsPage` — match this).

## Acceptance criteria

- [ ] Overview page renders with real system stats (uptime, memory, load) from `GET /api/system`
- [ ] StatusHero counts reflect the real service catalogue from `GET /api/services`
- [ ] Widget drag/resize/add/remove/reset still works (localStorage layout unchanged)
- [ ] Loading skeletons appear while data is in flight
- [ ] No mock seed data rendered in production
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
# Dev server: navigate to /overview
# Network tab: confirm GET /api/system and GET /api/services fire on load
curl http://localhost:3080/api/system -b <session-cookie>
curl http://localhost:3080/api/services -b <session-cookie>
```

## Notes / gotchas

- `api.history` in the mock (line 75 of `mocks/api.ts`) calls `live.history()` — this maps to alert history, not service health snapshots. The contracts endpoint is `GET /api/alerts/history`.
- The overview widget grid uses `react-grid-layout` with `localStorage` persistence keyed `"cortex.overview.layout.v3"` — do not change this key or the layout spec shape.
- `GET /api/system` returns `{uptime, load, memory, disk}`. The mock `initialSystem` also includes `drives` and `mounts` (used by Storage page). The overview widgets likely only consume the top-level fields; confirm in `widgets.tsx` before adapting.
- WP-10 must be done for final wiring; before that, the page can be developed against the contract shape, returning a real empty-state if the backend is not yet up.
