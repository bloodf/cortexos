# WP-38 — UI: Approvals + Audit
- **Wave:** 2   **Depends-on:** WP-04, WP-16 (final wiring)   **Parallel-safe-with:** WP-30–WP-37, WP-39–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.approvals.tsx`
  - `src/routes/_authenticated.audit.tsx`
  - `src/features/Approvals.tsx`
  - `src/features/Audit.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Approvals queue (pending/resolved tabs with grant/revoke actions) and Audit log (paginated table + chain-verify badge) to real data. Replace `api.approvals` and `api.audit` / `api.auditList` mock calls with the WP-04 typed client. Grant calls `POST /api/approvals/:id/grant`; revoke calls `POST /api/approvals/:id/revoke`; chain verify calls `GET /api/audit/verify`. All mutations send CSRF and are admin-gated. Visual layout stays 1-1 with sys-pilot.

## Read first

- `src/features/Approvals.tsx` — mock call sites: `api.approvals` (queryFn); `setStatus()` mock uses `qc.setQueryData`; deny dialog uses local state only
- `src/features/Audit.tsx` — mock call sites: `api.audit` (queryFn), `api.auditList` (DataTable server prop); chain-valid badge is hardcoded `"chain valid"`
- `src/mocks/api.ts` — `api.approvals`, `api.audit`, `api.auditList`
- `01-API-CONTRACT.md` §Approvals:
  - `GET /api/approvals` (any) query(status, page) → `{pending:[]}`
  - `POST /api/approvals` (admin) `{action, payload, ttlSec}` → `{token, expiresAt, ...}`
  - `POST /api/approvals/:id/grant` (admin) → `{ok, token}`
  - `POST /api/approvals/:id/revoke` (admin) → `{ok}`
  - `DELETE /api/approvals/:id` (admin) → `{ok}`
- `01-API-CONTRACT.md` §Audit:
  - `GET /api/audit` (any) query(actor, surface, action, result, since, page) → `{events:[], surfaces, actions}`
  - `GET /api/audit/verify` (admin) query(from) → `{ok, brokenAt?}`
- `src/lib/api/` (WP-04) — typed client
- `src/lib/adapters/` (WP-04) — `ApprovalToken` and `AuditEvent` from contracts → component shapes
- Legacy reference: `packages/dashboard/src/routes/(authed)/approvals/+page.server.ts`, `packages/dashboard/src/routes/(authed)/approvals/[id]/+page.server.ts`, `packages/dashboard/src/routes/(authed)/audit/+page.server.ts`, `packages/dashboard/src/routes/(authed)/audit/verify/+page.server.ts`

## Steps

### Approvals

1. **Replace `api.approvals` with real client.**
   - `queryFn: api.approvals` → `queryFn: () => apiClient.approvals.list({ status: "pending" })` then extract `data.pending`.
   - Query key stays `["approvals"]`. Add `refetchInterval: 5000` (approval queue should stay live).
   - Adapt `ApprovalToken` from contracts to `ApprovalRequest` component shape (fields: `id`, `summary`, `tool`/`action`, `actor`, `requested_at`, `status`, `args_preview`, `reason`).

2. **Wire grant action.**
   - "Approve" button: replace `setStatus(id, "approved")` with `POST /api/approvals/:id/grant` + CSRF.
   - On success, the response includes `{ok, token}`. Invalidate `["approvals"]` query.
   - Show `toast.success("Request granted")` with the token TTL if available.

3. **Wire revoke / deny action.**
   - "Deny" button (with reason dialog): call `POST /api/approvals/:id/revoke` + CSRF on confirm.
   - The current deny dialog collects a `reason` string — pass it in the request body if WP-16 accepts it; otherwise log it client-side only and still call revoke.
   - On success, invalidate `["approvals"]`.

4. **Resolved tab.**
   - Fetch resolved/historical approvals: `GET /api/approvals?status=resolved` (or `status=granted|revoked` — check WP-16). Display in the "Resolved" tab using the same `card()` render function.

### Audit

5. **Replace `api.audit` / `api.auditList` with real client.**
   - `queryFn: api.audit` → `queryFn: () => apiClient.audit.list()`.
   - DataTable `server` prop `api.auditList` → paginated client call: `apiClient.audit.list({ q, page, pageSize, sortKey, sortDir })`.
   - Adapt `AuditEvent` from contracts to `AuditEntry` component shape (fields: `id`, `actor`, `tool`, `tool_class`, `decision`, `decision_reason`, `result`, `args_hash`, `created_at`).

6. **Wire chain-verify badge.**
   - The current badge is hardcoded: `<Badge>chain valid</Badge>`.
   - Replace with a `useQuery` call: `queryFn: () => apiClient.audit.verify()` → `{ok, brokenAt?}`.
   - If `ok === true`: show green "chain valid" badge (existing style).
   - If `ok === false`: show red "chain BROKEN at …" badge with `brokenAt` timestamp.
   - `refetchInterval: 30000` (check every 30 s; verify is admin-only but the badge can be shown to all by requesting with current session — server returns 403 if non-admin; handle gracefully by hiding the badge).
   - Admin gate: only call `verify` if `user.is_admin`; non-admin users see no verify badge.

7. **Loading / empty states.**
   - Approvals: pending list empty → "No pending approvals." (already present in JSX — keep).
   - Audit: DataTable skeleton while loading; empty table → DataTable's built-in empty state.

## Acceptance criteria

- [ ] Approvals page lists real pending tokens from `GET /api/approvals`
- [ ] Grant button calls `POST /api/approvals/:id/grant` with CSRF; queue refreshes
- [ ] Deny button calls `POST /api/approvals/:id/revoke` with CSRF; queue refreshes
- [ ] Resolved tab shows historical approvals
- [ ] Audit table paginates via `GET /api/audit` with real events
- [ ] Chain-verify badge reflects real `GET /api/audit/verify` result (green/red)
- [ ] No hardcoded "chain valid" badge or `qc.setQueryData` mock mutations
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
curl http://localhost:3080/api/approvals?status=pending -b <session>
curl http://localhost:3080/api/audit?page=0&pageSize=25 -b <session>
curl http://localhost:3080/api/audit/verify -b <session>
curl -X POST http://localhost:3080/api/approvals/<id>/grant \
  -H "x-csrf-token: <csrf>" -b <session>
```

## Notes / gotchas

- `ApprovalToken` in `@cortexos/contracts` has fields like `action`, `payload`, `ttlSec`, `expiresAt`, `sessionId`, `actionHash`. The `ApprovalRequest` mock type has `summary`, `tool`, `actor`, `args_preview` — the adapter must map `action` → `tool`, synthesize `summary` from `action + payload`, and format `args_preview` from `payload`.
- `GET /api/audit/verify` is admin-only (`403` for non-admin). Guard the query with `enabled: !!user?.is_admin` so non-admin users never see a 403 in the console.
- The audit `decision` field in the contracts uses `"allow" | "deny"` (matching legacy). The component colors `allow` → green, anything else → red — this mapping should remain correct.
- `GET /api/approvals` returns `{pending:[]}` in the contract. WP-16 may also return `{resolved:[]}` or require a separate `status` query param — check WP-16 implementation before writing the resolved tab fetch.
- Approval tokens are single-use and session-bound. The grant endpoint `consume()`s the token server-side. The frontend does not need to handle token storage.
