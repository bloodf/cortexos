# WP-17 — API: Alerts

- **Wave:** 1
- **Depends-on:** WP-01, WP-02
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-13, WP-14, WP-15, WP-16, WP-18, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/routes/api/alerts/`
- **Do NOT touch:** `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, any other WP's folder

## Objective

Port the alerts CRUD endpoints and history endpoint from the legacy SvelteKit app. Two distinct data models live here: **alert rules** (long-lived trigger conditions per service) and **operational alerts** (transient feed / toasts). The history endpoint returns past rule firings joined with rule and service names. All endpoints use the `alerts` repo from WP-02.

## Read first

- **Legacy repo (primary source):**
  - `packages/dashboard/src/lib/server/db/repos/alerts.ts` — full file:
    - Rule-based: `listAlertRules`, `getAlertRuleById`, `createAlertRule`, `updateAlertRule`, `deleteAlertRule`
    - History: `listAlertHistory`, `insertAlertHistory`, `listAlertHistoryWithNames`, `deleteAlertHistoryOlderThan`
    - Operational: `listOperationalAlerts`, `getOperationalAlertById`, `createOperationalAlert`, `acknowledgeOperationalAlert`, `deleteOperationalAlert`
    - Types: `AlertSeverity` (`info|warn|error|critical`), `AlertCondition` (`offline|online|response_time`)
- **Legacy API handlers:**
  - `packages/dashboard/src/routes/api/alerts/+server.ts` — GET list + POST create
  - `packages/dashboard/src/routes/api/alerts/[id]/+server.ts` — GET detail + PATCH update + DELETE
  - `packages/dashboard/src/routes/api/alerts/history/+server.ts` — GET history
- **Schema tables (WP-02):** `alertRules`, `alertHistory`, `alerts`, `services` — in `src/server/db/schema.ts`
- **Contract section:** `01-API-CONTRACT.md §Alerts (WP-17)`

## Steps

The contract maps `/api/alerts` to both alert rules and operational alerts. Examine the legacy handlers to determine which table each endpoint targets; port the same mapping.

1. **`src/routes/api/alerts/index.ts`:**
   ```
   GET  /api/alerts — auth: any
        query: {severity?, unacknowledgedOnly?: boolean, limit?: number}
        → listOperationalAlerts(db, opts)
        returns {alerts: Alert[]}

   POST /api/alerts — auth: admin
        input: AlertCreateSchema
        → createOperationalAlert(db, input)
        returns Alert (201)
   ```
   `AlertCreateSchema` (zod):
   ```ts
   z.object({
     kind: z.string().min(1).max(64),
     title: z.string().min(1).max(255),
     message: z.string().max(2000).optional().nullable(),
     severity: z.enum(['info','warn','error','critical']),
     serviceId: z.number().int().positive().optional().nullable(),
   })
   ```

2. **`src/routes/api/alerts/$id/index.ts`:**
   ```
   GET    /api/alerts/:id — auth: any
          → getOperationalAlertById(db, id) or 404

   PATCH  /api/alerts/:id — auth: admin
          input: AlertPatchSchema (all fields optional)
          For acknowledge: { acknowledgedAt: 'now' } or a dedicated action field
          → acknowledgeOperationalAlert(db, id) when acknowledging
          returns Alert

   DELETE /api/alerts/:id — auth: admin
          → deleteOperationalAlert(db, id)
          returns {ok: true}
   ```

3. **`src/routes/api/alerts/history/index.ts`:**
   ```
   GET /api/alerts/history — auth: any
       query: {ruleId?: number, page?: number}
       → listAlertHistoryWithNames(db, { limit: 50 }) filtered by ruleId if provided
       returns {history: AlertHistoryItem[]}
   ```
   `listAlertHistoryWithNames` returns joined rows with `ruleName`, `serviceName`, `status`, `message`, `timestamp`. Map directly to `AlertHistoryItem[]`.

   If `ruleId` is provided, use `listAlertHistory(db, { ruleId, limit: 50 })` instead and join manually, or call `listAlertHistoryWithNames` and filter post-query (simpler for M3).

4. **Alert rules sub-resource** (if the legacy UI also needs a rules CRUD — check the legacy handler):
   The legacy `alerts/+server.ts` may serve both rules and operational alerts depending on a query param or path. Check the legacy file and mirror the same routing. If the UI needs rules CRUD, add:
   ```
   GET  /api/alerts/rules — auth: any → {rules: AlertRule[]}
   POST /api/alerts/rules — auth: admin, input: AlertRuleCreateSchema → AlertRule (201)
   GET/PATCH/DELETE /api/alerts/rules/:id — auth: admin
   ```
   Only implement these if the legacy handler or contract references them; do not invent.

5. **Auth / rate-limit:** all endpoints use `defineApiRoute`; GET routes `auth: 'any'`; POST/PATCH/DELETE `auth: 'admin'`; `surface: 'alerts'`; no rate-limit overrides.

6. **Input validation:** severity must be one of `info|warn|error|critical` (the repo's `validateSeverity` asserts this; the zod schema provides a pre-flight check at the route layer). kind must be 1–64 chars; title 1–255 chars.

7. **Error handling:** `getOperationalAlertById` returns null → `notFoundError`. Validation errors in the repo (invalid severity, kind/title length) → catch and re-throw as `validationError`.

## Acceptance criteria

- [ ] `GET /api/alerts` returns `{alerts: Alert[]}` from `alerts` table (operational feed); supports `?severity=error` filter
- [ ] `POST /api/alerts` creates an operational alert; rejects non-admin with 403; validates severity enum
- [ ] `GET /api/alerts/:id` returns the alert; 404 for missing id
- [ ] `PATCH /api/alerts/:id` acknowledges an alert (sets `acknowledgedAt`); returns updated Alert
- [ ] `DELETE /api/alerts/:id` removes alert; returns `{ok:true}`
- [ ] `GET /api/alerts/history` returns `{history: AlertHistoryItem[]}` with `ruleName` and `serviceName` joined; supports `?ruleId=` filter
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# List operational alerts
curl -s http://localhost:3080/api/alerts \
  -b "cortexos_session=$SESSION" | jq '{count:.alerts|length}'

# Create alert
curl -s -X POST http://localhost:3080/api/alerts \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"kind":"test","title":"Test alert","severity":"warn"}' | jq .id

# Alert history
curl -s http://localhost:3080/api/alerts/history \
  -b "cortexos_session=$SESSION" | jq '.history|length'

# DB check
psql $DATABASE_URL -c "SELECT id, kind, severity, acknowledged_at FROM alerts ORDER BY created_at DESC LIMIT 5;"
psql $DATABASE_URL -c "SELECT ah.id, ar.name as rule, s.name as svc FROM alert_history ah JOIN alert_rules ar ON ah.rule_id=ar.id JOIN services s ON ah.service_id=s.id LIMIT 5;"
```

## Notes / gotchas

- **Two data models** — `alerts` (operational toasts) and `alert_rules` + `alert_history` (rule engine). The contract's `/api/alerts` endpoints map to **operational alerts** (the `alerts` table). The `/api/alerts/history` endpoint maps to `alert_history` joined with `alert_rules` and `services`. Do not conflate the two.
- **`validateSeverity` in repo** — the repo throws a plain `Error` for invalid severity. Catch this in the route handler and re-throw as `validationError` so the envelope is correct.
- **`listAlertHistoryWithNames`** — this function does a 3-table join (`alert_history`, `alert_rules`, `services`) and returns `AlertHistoryItem[]` with `timestamp` as ISO string. Use it directly; do not rewrite the join in the route.
- **Acknowledge vs update** — the `PATCH` endpoint for operational alerts primarily serves the "acknowledge" action. The legacy handler calls `acknowledgeOperationalAlert(db, id)` which sets `acknowledgedAt = NOW()` if not already set (idempotent). A general-purpose patch (changing severity, message) is not implemented in the legacy repo — do not add it.
- **`/api/alerts/history` path collision** — TanStack routing: `history` is a static segment that must be registered before (or take priority over) the `$id` dynamic segment. Ensure the static `history` route does not get shadowed by the `$id` route. Use TanStack's route file naming to make `history` a sibling folder of `$id`, not a child.
- **Pagination** — `listAlertHistoryWithNames` takes `limit` (not `page`). For M3 simplicity, cap at `limit: 50`. Full pagination is a Wave-4 follow-up.
