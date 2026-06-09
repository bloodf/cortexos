# WP-35 — UI: Systemd
- **Wave:** 2   **Depends-on:** WP-04, WP-13 (final wiring)   **Parallel-safe-with:** WP-30–WP-34, WP-36–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.systemd.tsx`
  - `src/routes/_authenticated.systemd.$unit.tsx`
  - `src/features/Systemd.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Systemd list page (unit table with start/stop/restart actions) and the unit detail route to real data. Replace all `api.systemd` / `api.systemdList` mock calls with the WP-04 typed client hitting `POST /api/systemd/actions` and `GET /api/systemd/:name/logs`. Unit enable/disable (`Switch`) maps to the `enable`/`disable` action. Visual layout stays 1-1 with sys-pilot.

## Read first

- `src/features/Systemd.tsx` — mock call sites: `api.systemd` (queryFn for full list), `api.systemdList` (DataTable server prop); action handlers call `qc.setQueryData` mocks
- `src/routes/_authenticated.systemd.$unit.tsx` — unit detail route (read current content)
- `src/mocks/api.ts` — `api.systemd`, `api.systemdList`
- `01-API-CONTRACT.md` §Systemd:
  - `POST /api/systemd/actions → {result}` (admin; destructive→approval) `{action, unit}` allowlisted
  - `GET /api/systemd/:name/logs → {lines:[]}` (any; query: lines)
- `src/lib/api/` (WP-04) — typed client
- `src/lib/adapters/` (WP-04) — `SystemdUnit` adapter (contracts → component shape)
- Legacy reference: `packages/dashboard/src/routes/(authed)/systemd/+page.server.ts`, `packages/dashboard/src/routes/(authed)/systemd/[name]/+page.server.ts`, `packages/dashboard/src/routes/(authed)/systemd/[name]/logs/+server.ts`
- Legacy allowlist: `packages/dashboard/src/lib/server/policy.ts` systemd section (start, stop, restart, enable, disable, reload)

## Steps

1. **Replace list query with real client.**
   - The page uses `useQuery({ queryKey: ["systemd"], queryFn: api.systemd })` for total counts in the `PageHeader` description, and `DataTable server={{ queryKey: ["systemd"], fetch: api.systemdList }}` for the paginated table.
   - Replace `api.systemd` → `apiClient.systemd.list()` returning `data.items` (or the full array if the endpoint returns all units).
   - Replace `api.systemdList` → a client function wrapping `GET /api/systemd/units` (if WP-13 exposes a list endpoint) or performing client-side pagination over the full response. Confirm endpoint path with WP-13 output; the contract section only specifies actions + logs, so check if WP-13 adds a list endpoint or if units come from a different mechanism.
   - Adapt `SystemdUnit` from contracts (fields: `name`, `load`, `active`, `sub`, `description`, `enabled`) to the component shape.

2. **Wire unit actions — start / stop / restart.**
   - Replace `setActive()` mock with: `POST /api/systemd/actions {action: "start"|"stop"|"restart", unit: name}` + CSRF header + admin gate.
   - On success, invalidate `["systemd"]` query key (real refetch replaces `qc.setQueryData`).
   - Show `toast.error(envelope.message)` on failure.
   - Destructive restart (if configured as approval-required in WP-13 allowlist) → approval flow.

3. **Wire enable / disable (`Switch`).**
   - Replace `setEnabled()` mock with: `POST /api/systemd/actions {action: "enable"|"disable", unit: name}` + CSRF.
   - The `Switch` component already checks `disabled={!isAdmin}` — keep that gate.
   - Invalidate `["systemd"]` on success.

4. **Unit detail route (`_authenticated.systemd.$unit.tsx`).**
   - Load unit details: if WP-13 exposes `GET /api/systemd/:name`, use that; otherwise find from the list query by `params.unit`.
   - Fetch logs: `GET /api/systemd/:name/logs?lines=100` → `{lines:[]}`. Display in the existing `LogViewer` or `LogStream` component on the detail page.
   - Wire action buttons (start/stop/restart) on the detail page using the same pattern as step 2.
   - `refetchInterval` for logs: 5000 ms (streaming-adjacent experience).

5. **Loading / empty states.**
   - DataTable skeleton while loading. If the unit list is empty, `<EmptyState>` with "No systemd units found."
   - Log panel: while loading, show a skeleton line block; if empty response, "No log lines available."

## Acceptance criteria

- [ ] Systemd table renders real units from the backend; unit count accurate in PageHeader
- [ ] Start/stop/restart buttons call `POST /api/systemd/actions` with CSRF; query invalidated on success
- [ ] Enable/disable Switch calls `POST /api/systemd/actions {action: "enable"|"disable"}` with CSRF
- [ ] Unit detail route loads real data and live journal logs via `GET /api/systemd/:name/logs`
- [ ] No `qc.setQueryData` mock mutations remain
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
# Dev: /systemd — verify real unit names/states appear
curl http://localhost:3080/api/systemd/<unit>/logs?lines=50 -b <session>
curl -X POST http://localhost:3080/api/systemd/actions \
  -H "Content-Type: application/json" -H "x-csrf-token: <csrf>" \
  -d '{"action":"restart","unit":"caddy.service"}' -b <session>
```

## Notes / gotchas

- The contract for `POST /api/systemd/actions` says "admin (destructive→approval)". The legacy `policy.ts` treats `stop` and `disable` as potentially destructive. Check WP-13 to confirm which actions require an approval token and wire accordingly.
- The mock `setActive` / `setEnabled` pattern updates the cache optimistically. Replace with query invalidation (pessimistic update) — simpler and correct. If optimistic UI is desired, it is a WP-35 concern to implement it correctly, not a template requirement.
- There is no separate GET endpoint for a single systemd unit in the contract — the detail page must either use the list query (find by name) or check if WP-13 adds one.
- `GET /api/systemd/:name/logs` uses `?lines=N` not `?tail=N`. Match the query param to what WP-13 implements.
- The legacy `systemd/[name]/logs/+server.ts` streams via Server-Sent Events; the contract says `{lines:[]}` (one-shot). Use one-shot + polling (`refetchInterval`) rather than SSE unless WP-13 explicitly provides a streaming endpoint.
