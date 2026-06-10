# WP-37 — UI: Mail-Guardian
- **Wave:** 2   **Depends-on:** WP-04, WP-15 (final wiring)   **Parallel-safe-with:** WP-30–WP-36, WP-38–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.mail-guardian.tsx`
  - `src/features/MailGuardian.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Mail-Guardian two-pane review UI to real data from `GET /api/mail-guardian/reviews` and the account management panel. Replace `api.mail` / `api.mailList` mock calls with the WP-04 typed client. Single-item approve/flag actions call `POST /api/mail-guardian/:id/approve|flag`. Batch operations call `POST /api/mail-guardian/batch`. All mutations send CSRF. Visual layout (two-pane split: list + detail) stays 1-1 with sys-pilot.

## Read first

- `src/features/MailGuardian.tsx` — mock call sites: `api.mail` (queryFn), batch/flag/approve handlers use `qc.setQueryData`; two-pane layout with `Checkbox` batch selection
- `src/mocks/api.ts` — `api.mail`, `api.mailList`
- `01-API-CONTRACT.md` §Mail-Guardian:
  - `GET /api/mail-guardian/reviews` (any) query(account, status, page) → `{reviews}`
  - `POST /api/mail-guardian/:id/flag` (admin) → `{review}`
  - `POST /api/mail-guardian/:id/approve` (admin) → `{review}`
  - `POST /api/mail-guardian/batch` (admin) `{ids, decision}` → `{updated}`
  - `GET/POST /api/mail-guardian/accounts` (admin) → `{accounts}` / `MailAccount`
  - `PUT/PATCH/DELETE /api/mail-guardian/accounts/:slug` (admin)
- `src/lib/api/` (WP-04) — typed client
- `src/lib/adapters/` (WP-04) — `MailGuardianReview` from contracts → `MailReview` component shape
- Legacy reference: `packages/dashboard/src/routes/(authed)/mail-guardian/+page.server.ts`, `packages/dashboard/src/routes/(authed)/mail-guardian/+page.svelte`

## Steps

1. **Replace `api.mail` list query with real client.**
   - Swap `queryFn: api.mail` for `queryFn: () => apiClient.mailGuardian.reviews({ status: "pending", page: 0 })` then extract `data.reviews`.
   - Query key stays `["mail"]`.
   - The two-pane list currently shows all reviews (pending first). To match legacy behavior, fetch pending by default; consider adding a status filter toggle (pending / all) if sys-pilot already has one — do not add new UI elements, only wire existing ones.
   - Adapt `MailGuardianReview` from contracts to the `MailReview` shape the component expects (fields: `id`, `from`, `subject`, `snippet`, `body`, `risk`, `status`, `received_at`, `account`).

2. **Wire single-item approve / flag.**
   - `setStatus(id, "approved")` mock → `POST /api/mail-guardian/:id/approve` + CSRF header.
   - `setStatus(id, "flagged")` mock → `POST /api/mail-guardian/:id/flag` + CSRF header.
   - On success, invalidate `["mail"]` query key (or update the single item optimistically).
   - Show `toast.success` on success, `toast.error(envelope.message)` on failure.
   - Both approve and flag require `admin` auth — the existing `useAuth()` user check gate applies.

3. **Wire batch operations.**
   - `batch("approved")` / `batch("flagged")` mock → `POST /api/mail-guardian/batch {ids: [...], decision: "approved"|"flagged"}` + CSRF.
   - On success, invalidate `["mail"]`, clear `picked` set.
   - Show `toast.success(`${updated.length} emails processed`)`.

4. **Accounts panel (if present in the route).**
   - If the `_authenticated.mail-guardian.tsx` route includes account management (CRUD for mail accounts), wire:
     - `GET /api/mail-guardian/accounts` → account list.
     - `POST /api/mail-guardian/accounts` → create account (admin).
     - `DELETE /api/mail-guardian/accounts/:slug` → delete (admin).
   - If the sys-pilot UI does not have an accounts panel in this route, skip — do not add new UI.

5. **Pagination.**
   - The review list currently renders all items from the array. Wire server-side pagination if the component has a "load more" or paginator element. If not, fetch a large page (e.g. `pageSize: 100`) and render all.

6. **Loading / empty states.**
   - While loading, render a skeleton list in the left pane. Right pane: "Select an email."
   - If reviews list is empty: render `<EmptyState>` in the left pane — "No emails pending review."

## Acceptance criteria

- [ ] Left pane lists real mail reviews from `GET /api/mail-guardian/reviews`
- [ ] Approve button calls `POST /api/mail-guardian/:id/approve` with CSRF; list refreshed
- [ ] Flag button calls `POST /api/mail-guardian/:id/flag` with CSRF; list refreshed
- [ ] Batch approve/flag calls `POST /api/mail-guardian/batch`; selection cleared on success
- [ ] Right pane shows real email body (not mock content)
- [ ] No `qc.setQueryData` mock mutations remain
- [ ] Visual appearance (two-pane split, batch toolbar, risk badges) unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
curl http://localhost:3080/api/mail-guardian/reviews?status=pending -b <session>
curl -X POST http://localhost:3080/api/mail-guardian/<id>/approve \
  -H "x-csrf-token: <csrf>" -b <session>
curl -X POST http://localhost:3080/api/mail-guardian/batch \
  -H "Content-Type: application/json" -H "x-csrf-token: <csrf>" \
  -d '{"ids":["<id1>","<id2>"],"decision":"approved"}' -b <session>
```

## Notes / gotchas

- The mock `MailReview` type (in `src/mocks/types.ts`) has a `risk` field (`"low"|"medium"|"high"`) and `status` (`"pending"|"approved"|"flagged"`). The contracts `MailGuardianReview` type may use different field names — use the adapter layer to normalize.
- The `riskColor` map in `MailGuardian.tsx` depends on the `risk` field exactly matching `"low"|"medium"|"high"`. Ensure the adapter maps correctly; do not change the component's color logic.
- Approve and flag are admin-only. The current UI shows approve/flag buttons unconditionally — add an `isAdmin` gate matching the pattern used in other feature files (`const isAdmin = !!user?.is_admin`), hiding the buttons for non-admin users.
- The `cortex-mail-guardian` package classifier runs server-side; the frontend only consumes the already-classified `risk` field.
- Batch `decision` values must match what WP-15 implements — confirm `"approved"` and `"flagged"` are valid (vs. e.g. `"approve"` / `"flag"`).
