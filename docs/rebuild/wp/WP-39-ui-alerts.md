# WP-39 — UI: Alerts
- **Wave:** 2   **Depends-on:** WP-04, WP-17 (final wiring)   **Parallel-safe-with:** WP-30–WP-38, WP-40–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.alerts.tsx`
  - `src/features/Alerts.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Alerts page (timeline / history / rules tabs) to real data from `GET /api/alerts` (rules) and `GET /api/alerts/history`. Replace `api.alerts.rules`, `api.alerts.history`, `api.alerts.rulesList`, `api.alerts.historyList` mock calls with the WP-04 typed client. Rule enable/disable and CRUD actions call the appropriate `PATCH/DELETE /api/alerts/:id` endpoints with CSRF. Visual layout (three tabs: Timeline, History, Rules) stays 1-1 with sys-pilot.

## Read first

- `src/features/Alerts.tsx` — mock call sites: `api.alerts.rules` (queryFn), `api.alerts.history` (queryFn with `refetchInterval: 3000`), `api.alerts.rulesList` (DataTable server), `api.alerts.historyList` (DataTable server)
- `src/mocks/api.ts` — `api.alerts.rules`, `api.alerts.history`, `api.alerts.rulesList`, `api.alerts.historyList`
- `01-API-CONTRACT.md` §Alerts:
  - `GET /api/alerts` (any) → `{alerts}` — alert rules list
  - `POST /api/alerts` (admin) `AlertCreate` → `Alert`
  - `GET /api/alerts/:id` (any) → `Alert`
  - `PATCH /api/alerts/:id` (admin) `AlertPatch` → `Alert`
  - `DELETE /api/alerts/:id` (admin) → `{ok}`
  - `GET /api/alerts/history` (any) query(ruleId, page) → `{history}`
- `src/lib/api/` (WP-04) — typed client
- `src/lib/adapters/` (WP-04) — `Alert` from contracts → `AlertRule` component shape; history adapter
- `src/components/IncidentTimeline.tsx` — consumes history items for the Timeline tab
- Legacy reference: `packages/dashboard/src/routes/(authed)/alerts/+page.server.ts`, `packages/dashboard/src/routes/(authed)/alerts/rules/`, `packages/dashboard/src/routes/(authed)/alerts/history/`

## Steps

1. **Replace rules query.**
   - `queryFn: api.alerts.rules` → `queryFn: () => apiClient.alerts.list()` then extract `data.alerts`.
   - Query key stays `["alerts", "rules"]`.
   - Adapt `Alert` from contracts to `AlertRule` component shape: fields `id`, `name`, `condition`, `threshold_ms`, `enabled`.
   - DataTable server prop `api.alerts.rulesList` → client function wrapping the alerts array into `ListResult<AlertRule>` (client-side pagination is fine — rule counts are small).

2. **Replace history query.**
   - `queryFn: api.alerts.history` → `queryFn: () => apiClient.alerts.history()` then extract `data.history`.
   - Query key stays `["alerts", "history"]`. Keep `refetchInterval: 3000`.
   - Adapt history items to `AlertHistory` component shape: `id`, `timestamp`, `ruleName`, `serviceName`, `message`, `status`.
   - DataTable server prop `api.alerts.historyList` → client function wrapping history items.

3. **Wire rule enable/disable.**
   - The Rules tab shows a `<Switch checked={r.enabled} disabled />` — currently read-only. Wire to `PATCH /api/alerts/:id {enabled: boolean}` + CSRF for admin users.
   - Change `disabled` to `disabled={!isAdmin}` and add `onCheckedChange` handler calling the real API.
   - On success, invalidate `["alerts", "rules"]`.

4. **Wire rule create / delete (if UI exists).**
   - If the sys-pilot Alerts page has a "New rule" button or delete action in the Rules tab, wire them:
     - Create: `POST /api/alerts` with `AlertCreate` body + CSRF (admin).
     - Delete: `DELETE /api/alerts/:id` + CSRF (admin) with `<ConfirmDialog>`.
   - If no such UI exists in the current sys-pilot template, do not add new UI elements — keep the layout exactly as-is.

5. **Timeline tab.**
   - `<IncidentTimeline items={history} />` — wire `history` from the real query result (step 2). The component receives the same shape as the history items; adapt via the adapter.

6. **Loading / empty states.**
   - While loading rules/history, DataTable skeletons. Timeline: if no history, `<EmptyState>` "No incidents recorded."
   - If rules list is empty: DataTable empty state "No alert rules configured."

## Acceptance criteria

- [ ] Timeline tab shows real alert history from `GET /api/alerts/history`; refreshes every 3 s
- [ ] History tab DataTable paginates via real history endpoint
- [ ] Rules tab shows real alert rules from `GET /api/alerts`
- [ ] Enable/disable Switch calls `PATCH /api/alerts/:id` with CSRF for admin users
- [ ] PageHeader description (`N rules · N firing`) reflects real data
- [ ] No mock seed data rendered
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
curl http://localhost:3080/api/alerts -b <session>
curl http://localhost:3080/api/alerts/history -b <session>
curl -X PATCH http://localhost:3080/api/alerts/<id> \
  -H "Content-Type: application/json" -H "x-csrf-token: <csrf>" \
  -d '{"enabled":false}' -b <session>
```

## Notes / gotchas

- `GET /api/alerts` returns rules (`{alerts}`). `GET /api/alerts/history` returns fired events (`{history}`). These are two different endpoints — do not conflate them.
- The `Alert` contracts type represents a rule definition. The history type is separate (check contracts for `AlertHistory` or equivalent). Map accordingly in adapters.
- `api.alerts.history` in the mock calls `live.alerts()` which simulates random alert events. The real endpoint returns persisted history from the repo. The polling interval (`refetchInterval: 3000`) is preserved.
- The Rules tab `<Switch>` is currently `disabled` (read-only). Converting it to writable is a real behavioral change gated on `isAdmin` — this is correct and intended.
- `GET /api/alerts/history` supports `ruleId` and `page` query params. The DataTable history list can pass `ruleId` if the component supports filtering by rule — wire if the filter UI exists, skip if not.
