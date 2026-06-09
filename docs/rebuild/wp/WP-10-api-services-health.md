# WP-10 — API: Services & Health

- **Wave:** 1
- **Depends-on:** WP-01, WP-02
- **Parallel-safe-with:** WP-11, WP-12, WP-13, WP-14, WP-15, WP-16, WP-17, WP-18, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/health/` (scheduler + probe)
  - `packages/dashboard-next/src/routes/api/services/`
- **Do NOT touch:** `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, any other WP's folder

## Objective

Port the services catalog CRUD endpoints and the health check probe/scheduler from the legacy SvelteKit app into `packages/dashboard-next`. On server boot (via the hook wired in WP-00's `runtime.ts`), the health scheduler sweeps active services every 60 seconds, updates each row's `status`/`responseMs`/`lastCheckAt`, and appends a `service_health_log` row. The six REST endpoints must match `01-API-CONTRACT.md §Services & health` exactly.

## Read first

- **Legacy API handlers:**
  - `packages/dashboard/src/routes/api/services/+server.ts` — GET (list) + POST (create)
  - `packages/dashboard/src/routes/api/services/[id]/+server.ts` — GET/PATCH/DELETE by id
  - `packages/dashboard/src/routes/api/services/[id]/health/+server.ts` — GET snapshots + POST recheck
- **Legacy repo:**
  - `packages/dashboard/src/lib/server/db/repos/services.ts` — `listServices`, `getServiceById`, `createService`, `updateService`, `deleteService`, `listCategories`
- **Legacy scheduler:**
  - `packages/dashboard/src/lib/server/health/scheduler.ts` — `startHealthScheduler`, `sweepOnce`, probe implementations (http/tcp/systemd/docker/process)
- **Contract section:** `01-API-CONTRACT.md §Services & health (WP-10)`
- **Conventions:** `02-CONVENTIONS.md §Health scheduler boot`, `§defineApiRoute`

## Steps

1. **Port health scheduler** — copy `packages/dashboard/src/lib/server/health/scheduler.ts` verbatim to `src/server/health/scheduler.ts`. Replace SvelteKit import aliases (`$lib/server/db/client` → relative `../db/client`, etc.). The scheduler imports `getDb` from `src/server/db/client.ts` (WP-02), `listServices`/`updateService` from `src/server/db/repos/services.ts` (WP-02), and `serviceHealthLog` from `src/server/db/schema.ts` (WP-02). Probes use `execFile` (no shell) for systemd/docker/process. Keep `startHealthScheduler()` idempotent singleton pattern.

2. **Wire scheduler boot** — `src/server/health/index.ts` exports `{ startHealthScheduler }`. The WP-00 `runtime.ts` server hook calls it once. Do not call it per-request.

3. **Declare service CRUD routes:**

   `src/routes/api/services/index.ts` (or `route.ts` per TanStack convention):
   ```
   GET  /api/services  — auth: any, query: {category?, kind?, status?, activeOnly?, page?, pageSize?}
                         → calls listServices(db, opts), returns {rows, total}
   POST /api/services  — auth: admin, input: ServiceCreateSchema (zod)
                         → calls createService(db, input), returns Service (201)
   ```

   `src/routes/api/services/$id/index.ts`:
   ```
   GET    /api/services/:id  — auth: any  → getServiceById(db, id) or 404
   PATCH  /api/services/:id  — auth: admin, input: ServicePatchSchema → updateService(db, id, patch)
   DELETE /api/services/:id  — auth: admin → deleteService(db, id), returns {ok:true}
   ```

   `src/routes/api/services/$id/health/index.ts`:
   ```
   GET  /api/services/:id/health  — auth: any, query: {limit?:number}
                                    → serviceHealthLog rows for serviceId, newest-first
   POST /api/services/:id/health  — auth: admin, input: {source:string}
                                    → single probe via probe() from scheduler, persist, return snapshot
                                    rate-limit: 10/min per user
   ```

4. **Zod input schemas** — mirror the legacy validation exactly:
   - `ServiceCreateSchema`: `slug` (lowercase slug), `name`, `description?`, `healthUrl?`, `healthType` (enum http|tcp|docker|systemd|process), `category`, `openUrl?`, `kind` (enum app|service|docker|process|dashboard-launcher)
   - `ServicePatchSchema`: all fields optional version of the above plus `isActive`, `sortOrder`, `showInHealthcheck`, `showInWebui`

5. **Auth / rate-limit / audit** — use `defineApiRoute` (WP-01):
   - GET list/detail: `auth: 'any'`, no rate-limit override
   - POST create: `auth: 'admin'`, `surface: 'services'`, `action: 'services.create'`
   - PATCH/DELETE: `auth: 'admin'`, surface/action set accordingly
   - Health recheck POST: `auth: 'admin'`, `rateLimit: { limit: 10, windowSec: 60, bucket: 'user' }`

6. **Error handling** — 404 when `getServiceById` returns null (throw `notFoundError`); 400 on validation failure (handled by defineApiRoute wrapper); 500 on DB error (throw `systemError`).

## Acceptance criteria

- [ ] `GET /api/services` returns `{rows: Service[], total: number}` matching DB content; query filters `category`, `kind`, `status`, `activeOnly`, `page`, `pageSize` all work
- [ ] `POST /api/services` creates a row, returns 201 with the new `Service`; rejects non-admin with 403
- [ ] `GET /api/services/:id` returns the service or 404
- [ ] `PATCH /api/services/:id` updates fields; `DELETE` removes and returns `{ok:true}`
- [ ] `GET /api/services/:id/health` returns `{snapshots: HealthSnapshot[]}` from `service_health_log`
- [ ] `POST /api/services/:id/health` triggers a live probe, persists, returns snapshot
- [ ] Health scheduler starts exactly once at server boot; 60s interval; probes populate statuses
- [ ] Build passes: `pnpm --filter @cortexos/dashboard-next typecheck`
- [ ] No edits outside OWNS

## Verification commands

```bash
# Typecheck
pnpm --filter @cortexos/dashboard-next typecheck

# Against dev server (pnpm --filter @cortexos/dashboard-next dev)
curl -s http://localhost:3080/api/services | jq '{total,count:.rows|length}'

# Health recheck (requires admin session cookie)
curl -s -X POST http://localhost:3080/api/services/1/health \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"source":"manual"}' | jq .

# DB: verify health log rows accumulate
psql $DATABASE_URL -c "SELECT service_id, status, checked_at FROM service_health_log ORDER BY checked_at DESC LIMIT 5;"
```

## Notes / gotchas

- The health scheduler uses `execFile` (not `exec`) for systemd/docker/process probes — no shell, fixed argv, matches THREAT_MODEL §4.4.
- On non-Linux hosts or CI, `systemctl`/`docker` probes fail closed to `'unknown'` — the scheduler never throws out of `sweepOnce`.
- The scheduler must call `timer.unref()` so it does not keep the Node process alive in tests.
- `listServices(db, { activeOnly: true, pageSize: 500 })` is the sweep query — keep `pageSize: 500` cap.
- TanStack server routes use a different file convention from SvelteKit `+server.ts`. Follow the pattern established by WP-01's `defineApiRoute` — each route file exports a handler object, not individual `GET`/`POST` exports.
- The legacy `[id]` path param maps to TanStack's `$id` file-based segment.
- `serviceHealthLog` schema is in WP-02's `src/server/db/schema.ts` — do not redefine it here.
