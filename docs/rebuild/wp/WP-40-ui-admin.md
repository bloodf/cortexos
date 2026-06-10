# WP-40 — UI: Admin
- **Wave:** 2   **Depends-on:** WP-04, WP-10 (services), WP-18 (env-browser), WP-20 (auth/users) for final wiring   **Parallel-safe-with:** WP-30–WP-39, WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.admin.tsx`
  - `src/routes/_authenticated.admin.services.tsx`
  - `src/routes/_authenticated.admin.users.tsx`
  - `src/routes/_authenticated.admin.env-browser.tsx`
  - `src/routes/_authenticated.admin.badges.tsx`
  - `src/routes/_authenticated.admin.projects.tsx`
  - `src/routes/_authenticated.admin.account.tsx`
  - `src/routes/_authenticated.admin.alerts.tsx`
  - `src/routes/_authenticated.admin.audit.tsx`
  - `src/routes/_authenticated.admin.docker.tsx`
  - `src/routes/_authenticated.admin.incus.tsx`
  - `src/routes/_authenticated.admin.systemd.tsx`
  - `src/features/admin/Services.tsx`
  - `src/features/admin/Users.tsx`
  - `src/features/admin/EnvBrowser.tsx`
  - `src/features/admin/Badges.tsx`
  - `src/features/admin/Projects.tsx`
  - `src/features/admin/Account.tsx`
  - `src/features/admin/Alerts.tsx`
  - `src/features/admin/Audit.tsx`
  - `src/features/admin/Docker.tsx`
  - `src/features/admin/Incus.tsx`
  - `src/features/admin/Systemd.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, non-admin feature files

## Objective

Wire all admin sub-pages to real data and real actions. The admin section is gated to `is_admin` users. Key areas: services CRUD (`GET/POST/PATCH/DELETE /api/services`), users list (`GET /api/auth/me` + Linux PAM users), env-browser with PAM-unlock reveal UX (`GET /api/env-browser`, `POST /api/env-browser/unlock`), and badges/projects/account (real empty-states where no backend exists). All mutations send CSRF. Visual layout stays 1-1 with sys-pilot.

## Read first

- `src/features/admin/Services.tsx` — calls `api.services`; edit/delete buttons are mock toasts
- `src/features/admin/Users.tsx` — calls `api.users`; delete is a mock toast
- `src/features/admin/EnvBrowser.tsx` — calls `api.envFiles`; reveal is local state mock; no unlock flow
- `src/features/admin/Badges.tsx` — calls `api.badges`, `api.badgesList`
- `src/features/admin/Projects.tsx` — calls `api.projects`, `api.projectsList`
- `src/features/admin/Account.tsx` — likely reads from `useAuth()` user object
- `src/mocks/api.ts` — `api.services`, `api.users`, `api.envFiles`, `api.badges`, `api.projects`
- `01-API-CONTRACT.md` §Services (CRUD), §Env browser (`GET /api/env-browser`, `POST /api/env-browser/unlock`)
- `src/lib/api/` (WP-04) — typed client
- `src/lib/adapters/` (WP-04) — service, user adapters
- Legacy reference: `packages/dashboard/src/routes/(authed)/admin/+page.svelte`, `packages/dashboard/src/routes/(authed)/admin/services/`, `packages/dashboard/src/routes/(authed)/admin/env-browser/`

## Steps

### Admin gate

1. **Enforce admin-only access for all admin routes.**
   - `src/routes/_authenticated.admin.tsx` layout route: add `beforeLoad` that reads `ctx.user` (set by the `_authenticated` guard) and throws `redirect({ to: "/overview" })` if `!user.is_admin`.
   - This is a single guard in the admin layout route — all child routes inherit it.

### Services admin

2. **Replace `api.services` with real client.**
   - `queryFn: api.services` → `queryFn: () => apiClient.services()` (no `activeOnly` filter — admin sees all).
   - Wire "Add service" button: open a form dialog and call `POST /api/services` with `ServiceCreate` body + CSRF on submit.
   - Wire "Edit" button: `PATCH /api/services/:id` + CSRF.
   - Wire "Delete" button (already has `<ConfirmDialog>`): `DELETE /api/services/:id` + CSRF. This is a destructive action — check if it requires an approval token per WP-10 contract.
   - On success, invalidate `["services"]`.

### Users admin

3. **Replace `api.users` with real client.**
   - `queryFn: api.users` → `queryFn: () => apiClient.auth.users()` (check WP-20 for the exact endpoint — may be `GET /api/auth/users` or a Linux system reader).
   - If WP-20/WP-14 does not expose a user list endpoint, call `GET /api/auth/me` to get the current user and render a real empty-state for the rest: "User list requires a system users endpoint (WP-20)."
   - Wire "Remove" button (already has `<ConfirmDialog>`): if an endpoint exists, call it with CSRF. Otherwise, show a toast "User management requires server support."
   - Do NOT fabricate user data.

### Env-browser — PAM unlock reveal UX

4. **Replace `api.envFiles` with real client.**
   - `queryFn: api.envFiles` → `queryFn: () => apiClient.envBrowser.list({ path: selectedPath })`.
   - The real `GET /api/env-browser` response: `{path, revealed, revealExpiresAt, entries:[{key, value, masked}]}`.
   - Masked entries have `masked: true` and `value` = placeholder text. Revealed entries have `masked: false` and real cleartext `value`.
   - Update the env list to render each entry's `value` field. When `masked: true`, show dots; when `masked: false` (live grant active), show cleartext.

5. **Wire PAM-unlock reveal flow.**
   - Currently the "reveal" button is local state (`reveal[k]`) showing a fabricated mock value. Replace with the real flow:
     a. "Unlock" button (or per-key reveal): open a dialog asking for the admin's password.
     b. On submit, call `POST /api/env-browser/unlock {password}` + CSRF → `{ok, expiresAt, ttlSec}` (10-min grant).
     c. On success, refetch `GET /api/env-browser` — the server now returns cleartext values for the duration.
     d. Show a countdown badge: "Reveal active · expires in Xm" using `expiresAt`. Auto-refetch stops after `expiresAt` (use `refetchInterval` until then).
     e. Per-key copy button: copies the real `value` from the query data (no fake random value).
   - On `POST /api/env-browser/unlock` 401/403: show `toast.error("Incorrect password or permission denied")`.
   - **Never store the password in state beyond the form submission**; clear the input immediately after the POST.

6. **Badges, Projects, Account — real empty-states.**
   - `api.badges` / `api.badgesList`: if no `/api/badges` endpoint exists in the contract, render `<EmptyState title="No badges configured" description="Badge management is not yet implemented." />` rather than mock data.
   - `api.projects` / `api.projectsList`: similarly, if no projects endpoint in contract, real empty-state.
   - `Account`: wire to `useAuth()` user object for the current user's username/groups. If the page allows password change, do not wire it (no endpoint in contract) — render "Not available" or omit.
   - Do NOT render mock seed data for badges, projects, or account fields.

### Admin sub-routes that mirror other feature pages

7. **Admin Docker / Incus / Systemd / Alerts / Audit sub-pages.**
   - These are admin-panel views of the same data as their main counterparts. Wire them identically to WP-33/WP-34/WP-35/WP-39/WP-38 respectively (same client calls, same query keys — React Query deduplicates).
   - The admin versions may have additional CRUD actions not in the main pages — wire those if the UI has them, using the same API endpoints as the main domain WPs.

## Acceptance criteria

- [ ] All admin routes redirect non-admin users to `/overview`
- [ ] Services admin table shows real services; add/edit/delete wired to real API with CSRF
- [ ] Users admin shows real PAM users (or real empty-state if endpoint not yet available)
- [ ] Env-browser shows masked entries by default; unlock flow does PAM re-auth → reveals cleartext
- [ ] Reveal countdown badge shows expiry; refetch clears cleartext after grant expires
- [ ] Badges / Projects / Account show real empty-states, not mock seed data
- [ ] No fabricated env values (no `mock-${key.toLowerCase()}-value-...` pattern)
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
# Dev: navigate to /admin as non-admin → should redirect to /overview
curl http://localhost:3080/api/env-browser?path=/opt/cortexos/.secrets/dashboard.env -b <admin-session>
curl -X POST http://localhost:3080/api/env-browser/unlock \
  -H "Content-Type: application/json" -H "x-csrf-token: <csrf>" \
  -d '{"password":"<admin-pw>"}' -b <admin-session>
curl http://localhost:3080/api/services -b <admin-session>
```

## Notes / gotchas

- **Env-browser reveal UX is security-critical.** Never store the admin password in React state beyond the form submission. Never log it. The `POST /api/env-browser/unlock` sends it once, server-side PAM verifies it, and the response only contains `{ok, expiresAt, ttlSec}`.
- The mock `AdminEnvPage` generates fake values with `mock-${k.toLowerCase()}-value-${Math.random()...}` — remove this entirely. The real value comes from the API response `entry.value` field only.
- `GET /api/env-browser` requires an allowlisted `path` query param (server enforces allowlist). The client must pass one of the allowed paths. Build the path selector from a known list or from the response if the server returns available paths.
- Env-browser `revealExpiresAt` is an ISO timestamp. Compute remaining seconds client-side for the countdown badge with a `setInterval`.
- If WP-18 backend is not yet done, show a real empty-state for env-browser: "Env browser requires server-side configuration."
- The `api.badges` and `api.projects` endpoints are not in `01-API-CONTRACT.md` — there is no `/api/badges` or `/api/projects` backend. These pages must show real empty-states; do not use mock seed data.
