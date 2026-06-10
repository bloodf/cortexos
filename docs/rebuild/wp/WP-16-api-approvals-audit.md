# WP-16 — API: Approvals + Audit + Command Audit

- **Wave:** 1
- **Depends-on:** WP-01, WP-02, WP-03
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-13, WP-14, WP-15, WP-17, WP-18, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/routes/api/approvals/`
  - `packages/dashboard-next/src/routes/api/audit/`
  - `packages/dashboard-next/src/routes/api/dashboard_command_audit/`
- **Do NOT touch:** `src/server/approval/` (WP-03), `src/server/audit/` (WP-03), `src/server/db/`, `src/server/define-api-route.ts`, any other WP's folder

## Objective

Port the approvals, audit, and dashboard_command_audit endpoints. The approvals endpoints mint HMAC approval tokens (via WP-03's `mintApproval`), list pending tokens from the DB (via WP-02's `pending_approvals` repo), and grant/revoke them. The audit endpoints read the hash-chained `audit_log` table and expose a chain-verify endpoint. The dashboard_command_audit endpoints implement the two-phase lifecycle (start→finish) used by action dispatchers.

## Read first

- **Legacy API handlers:**
  - `packages/dashboard/src/routes/api/approvals/+server.ts` — GET list (returns `{pending:[]}` in M1; M3 queries DB), POST mint, DELETE revoke
  - `packages/dashboard/src/routes/api/approvals/[id]/grant/+server.ts` — POST grant
  - `packages/dashboard/src/routes/api/approvals/[id]/revoke/+server.ts` — POST revoke
  - `packages/dashboard/src/routes/api/audit/+server.ts` — GET with filters (limit, offset, surface, actor, result); calls in-memory `listAudit()` in legacy M1; M3 queries `audit_log` table
  - `packages/dashboard/src/routes/api/audit/verify/+server.ts` — GET chain verify
  - `packages/dashboard/src/routes/api/dashboard_command_audit/+server.ts` — GET list, POST start, PATCH finish
- **Legacy repos:**
  - `packages/dashboard/src/lib/server/db/repos/pending_approvals.ts` — `listPendingApprovals`, `getPendingApprovalById`, `createPendingApproval`, `resolvePendingApproval`, `deletePendingApproval`
  - `packages/dashboard/src/lib/server/db/repos/audit.ts` — `verifyAuditLogChain`, `appendAuditLog`, `listAgentGatewayAudit` (the `audit_log` chain walk + hash verification algorithm)
  - `packages/dashboard/src/lib/server/db/repos/dashboard_command_audit.ts` — `startDashboardCommand`, `finishDashboardCommand`, `listDashboardCommands`, `getDashboardCommandByRequestId`, `countDashboardCommands`
- **Legacy approval module (WP-03 owns the implementation):**
  - `packages/dashboard/src/lib/server/approval/index.ts` — `mintApproval`, `verifyApproval`, `consumeApproval`, `actionHashFor`
- **Contract section:** `01-API-CONTRACT.md §Approvals`, `§Audit`, `§Command audit (WP-16)`

## Steps

### Approvals

1. **`src/routes/api/approvals/index.ts`:**
   ```
   GET  /api/approvals — auth: any, query: {status?, page?}
        → listPendingApprovals(db, { openOnly: status==='open', page })
        returns {pending: PendingApproval[]}

   POST /api/approvals — auth: admin, input: MintInput
        → mintApproval({ action, payload, sessionId, userId, ttlSec })
        returns {token, expiresAt, issuedAt, actionHash, ttlSec}
   ```
   Mint input schema (mirror legacy `approvals/+server.ts`):
   ```ts
   z.object({
     action: z.string().min(1).max(256),
     payload: z.record(z.string(), z.unknown()).default({}),
     ttlSec: z.number().int().min(1).max(3600).optional(),
   })
   ```
   TTL default: `input.action.startsWith('reveal.') ? 300 : 60`.

2. **`src/routes/api/approvals/$id/grant/index.ts`:**
   ```
   POST /api/approvals/:id/grant — auth: admin
        → resolvePendingApproval(db, id, 'approve', user.username)
          consumeApproval(token, sessionId)  [if the row has a token field]
        returns {ok: true, token: <minted-or-existing>}
   ```
   Note: the legacy `grant` handler mints a new short-lived token for the action recorded in the DB row. Port from `packages/dashboard/src/routes/api/approvals/[id]/grant/+server.ts`.

3. **`src/routes/api/approvals/$id/revoke/index.ts`:**
   ```
   POST /api/approvals/:id/revoke — auth: admin
        → resolvePendingApproval(db, id, 'deny', user.username)
        returns {ok: true}
   ```

4. **`src/routes/api/approvals/$id/index.ts`:**
   ```
   DELETE /api/approvals/:id — auth: admin
          → deletePendingApproval(db, id)
          returns {ok: true}
   ```

### Audit

5. **`src/routes/api/audit/index.ts`:**
   ```
   GET /api/audit — auth: any, query: {actor?, surface?, action?, result?, since?, page?}
       → query audit_log table via listAgentGatewayAudit (or a dedicated audit_log query)
       returns {events: AuditEvent[], surfaces: string[], actions: string[]}
   ```
   The legacy M1 audit handler calls in-memory `listAudit()`. For M3 (this WP), query the `audit_log` table using the DB repo. Map columns: `actor` → `actorUserId` or `actor` field; `surface`, `action`, `result` as filters; `since` as a `Date` filter on `occurredAt`; paginate with `page` and default `pageSize: 50`.

   `surfaces` and `actions` are distinct value lists from the result set (or a separate query). Since the `audit_log` table may not have a `surface` column directly (it stores payload as JSONB), extract from payload or use the `auditLog.source` column as `surface`.

6. **`src/routes/api/audit/verify/index.ts`:**
   ```
   GET /api/audit/verify — auth: admin, query: {from?: string (ISO date)}
       → verifyAuditLogChain(db, { fromTs: from ? new Date(from) : undefined })
       returns {ok: boolean, brokenAt?: {id, occurredAt, reason}}
   ```
   The chain-verify algorithm is in WP-02's ported `src/server/db/repos/audit.ts`. Call it directly.

### Dashboard Command Audit

7. **`src/routes/api/dashboard_command_audit/index.ts`:**
   ```
   GET   /api/dashboard_command_audit — auth: admin, query: {status?, command?, since?, limit?}
         → listDashboardCommands(db, opts), returns list

   POST  /api/dashboard_command_audit — auth: admin, input: StartCommandInput
         → startDashboardCommand(db, input), returns DashboardCommandAudit (201)

   PATCH /api/dashboard_command_audit — auth: admin, input: {requestId, ...FinishCommandInput}
         → finishDashboardCommand(db, requestId, completion), returns DashboardCommandAudit
   ```
   POST input schema:
   ```ts
   z.object({
     requestId: z.string().uuid(),
     command: z.string().min(1).max(512),
     argv: z.array(z.string()),
     requestedBy: z.string().optional(),
     sourceIp: z.string().nullable().optional(),
     dashboardSessionId: z.string().nullable().optional(),
     timeoutMs: z.number().int().positive().optional(),
     approvedPolicy: z.string().optional(),
     mutationClass: z.string().optional(),
     targetScope: z.string().optional(),
     dryRun: z.boolean().optional(),
     metadata: z.record(z.string(), z.unknown()).optional(),
   })
   ```
   PATCH input schema: adds `status` (required), completion fields from `FinishCommandInput`.

8. **Auth / rate-limit:** all admin-only routes use `defineApiRoute` with `auth: 'admin'`; audit list is `auth: 'any'`; rate-limit defaults inherited.

## Acceptance criteria

- [ ] `POST /api/approvals` mints a token; token verifies with `verifyApproval`; single-use (second `consumeApproval` fails)
- [ ] `GET /api/approvals` returns `{pending:[]}` for empty DB; rows appear after `POST`
- [ ] `POST /api/approvals/:id/grant` returns `{ok:true, token}`; `POST /api/approvals/:id/revoke` returns `{ok:true}`
- [ ] `DELETE /api/approvals/:id` removes the row; 404 if not found
- [ ] `GET /api/audit` returns events with `surfaces` and `actions` arrays
- [ ] `GET /api/audit/verify` returns `{ok:true}` on an intact chain; `{ok:false, brokenAt:{...}}` after a tampered row
- [ ] `POST /api/dashboard_command_audit` creates row with `status='created'`; `PATCH` updates to completion status; `GET` lists rows
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# Mint approval token
TOKEN=$(curl -s -X POST http://localhost:3080/api/approvals \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"action":"docker.stop","payload":{"container":"myapp"}}' | jq -r .token)
echo "token: $TOKEN"

# Audit chain verify
curl -s http://localhost:3080/api/audit/verify \
  -b "cortexos_session=$SESSION" | jq '{ok}'

# Command audit start
curl -s -X POST http://localhost:3080/api/dashboard_command_audit \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"requestId":"'$(uuidgen)'","command":"systemctl","argv":["restart","caddy.service"]}' | jq .status
# expect "created"

# DB check
psql $DATABASE_URL -c "SELECT id, action, result FROM audit_log ORDER BY occurred_at DESC LIMIT 5;"
psql $DATABASE_URL -c "SELECT request_id, status FROM dashboard_command_audit LIMIT 5;"
```

## Notes / gotchas

- **`mintApproval` is WP-03** — this WP calls it from `src/server/approval/` (WP-03's output). Do not reimplement the HMAC logic here.
- **`verifyAuditLogChain` is WP-02** — the chain-walk algorithm is in `src/server/db/repos/audit.ts` (WP-02). This WP only calls it.
- **In-memory vs DB audit** — the legacy M1 audit list uses an in-memory ring buffer (`listAudit()`). For this Wave-1 WP, query the real `audit_log` table via Drizzle (WP-02's repo). The legacy `listAgentGatewayAudit` queries `agent_gateway_audit`; use it or write a similar query for `audit_log` depending on which table the UI consumes. The contract says `GET /api/audit` returns `AuditEvent[]` — map whatever the DB has.
- **`startDashboardCommand` requires `requestId`** — the route should accept a client-supplied UUID or generate one with `crypto.randomUUID()` if omitted.
- **`finishDashboardCommand` PATCH** — the route receives `requestId` in the body (not the URL) for the PATCH, matching the legacy `dashboard_command_audit/+server.ts` pattern. The `requestId` uniquely identifies the row; the update is a single-row touch.
- **Approval `grant` nuance** — the `pending_approvals` table records a human-in-the-loop approval request (e.g. an agent requesting a privileged action). The `grant` endpoint resolves the DB row AND mints a short-lived HMAC token that the requesting process can use as `x-cortex-approval-token`. Read the legacy grant handler carefully before implementing.
- **`since` query param** — parse as ISO 8601 date string → `new Date(since)`. If invalid, throw `validationError`.
