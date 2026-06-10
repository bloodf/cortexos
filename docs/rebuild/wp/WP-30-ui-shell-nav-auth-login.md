# WP-30 — UI: Shell / Nav / Auth / Login
- **Wave:** 2   **Depends-on:** WP-04, WP-20   **Parallel-safe-with:** WP-31 through WP-41
- **Owns (edit only these):**
  - `src/app/AppShell.tsx`
  - `src/app/Sidebar.tsx`
  - `src/app/TopBar.tsx`
  - `src/app/NavConfig.ts`
  - `src/app/CommandPalette.tsx`
  - `src/app/MobileTabBar.tsx`
  - `src/app/SimulateMenu.tsx`
  - `src/routes/_authenticated.tsx`
  - `src/routes/login.tsx`
  - `src/routes/__root.tsx`
  - `src/hooks/useAuth.tsx`
- **Do NOT touch:** `src/mocks/` (other than redirecting its seam), `src/lib/api/` internals (owned by WP-04), any route/feature file outside this list, legacy `packages/dashboard/`

## Objective

Replace the mock localStorage auth in `useAuth.tsx` and the `_authenticated` route guard with real session checks against `GET /api/auth/me` and `POST /api/auth/login` / `POST /api/auth/logout`. The shell layout (AppShell / Sidebar / TopBar) keeps its 1-1 visual; only the data plumbing changes. Admin-only nav items are gated on `user.is_admin` returned by the real API.

## Read first

- `src/hooks/useAuth.tsx` — current mock: localStorage + hardcoded `is_admin: true`
- `src/routes/_authenticated.tsx` — current guard: localStorage check only
- `src/routes/login.tsx` — calls `login(u, p)` from `useAuth`; redirect to `/overview` on success
- `src/app/NavConfig.ts` — nav groups; admin group items need admin gate
- `src/app/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx` — consume `useAuth()` for user display / logout
- `01-API-CONTRACT.md` §Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `02-CONVENTIONS.md` §Auth model — CSRF double-submit, `cortexos_session` cookie, `cortexos_csrf` cookie → `x-csrf-token` header on mutations
- `src/lib/api/` (WP-04 output) — the typed fetch client with CSRF injection
- Legacy: `packages/dashboard/src/routes/(auth)/login/+page.server.ts`, `packages/dashboard/src/routes/(authed)/+layout.server.ts`

## Steps

1. **Wire `useAuth` to real API.**
   - Replace `login()` mock: call `POST /api/auth/login` via the WP-04 client with `{username, password}`. On success the server sets `cortexos_session` + `cortexos_csrf` cookies. Store the returned `{user}` in React state (no localStorage needed for session truth — cookie is authoritative).
   - Replace `logout()`: call `POST /api/auth/logout` (sends CSRF header), then clear local user state and navigate to `/login`.
   - Add `me()` helper (or use a `useQuery` in the provider) calling `GET /api/auth/me` on mount to hydrate user state from the live session — handles page reload without re-login.
   - Keep `AuthUser` shape: `{username: string; is_admin: boolean}`. Map from the contracts `User` type via the adapter in `src/lib/adapters/`.
   - Remove the `switchUser` mock (keep the exported signature as a no-op for backwards compat).

2. **Update the `_authenticated` route guard.**
   - Replace the `localStorage.getItem("cortex.auth")` check with a real server-side or loader-level check: throw `redirect({ to: "/login" })` if `GET /api/auth/me` returns 401 / no user.
   - Use TanStack Router's `beforeLoad` to call the typed client; cache the result in the router context so child routes can access `ctx.user` without a second round-trip.
   - On 401 from any child route query, redirect to `/login` (handled centrally in the WP-04 client's error interceptor — coordinate with WP-04 agent).

3. **Gate admin nav items.**
   - In `Sidebar.tsx` / `NavConfig.ts`, hide or disable the `admin` group items when `user.is_admin === false`. The `SimulateMenu.tsx` (demo tool) should be removed entirely since the user role comes from the real PAM system.
   - `TopBar.tsx`: show real `user.username`; wire the logout button to the new `logout()`.

4. **Login page cleanup.**
   - Remove the "Try `admin` for admin role" hint text (real PAM determines roles).
   - Keep all visual elements 1-1 (logo, locale picker, form layout).
   - Display the server error message from the API envelope (`code: "auth"`, `message`) in the existing `err` state.

5. **CSRF bootstrap.**
   - After a successful login (cookies set), the WP-04 client reads `cortexos_csrf` cookie and injects it as `x-csrf-token` on all subsequent non-GET requests. Verify this wiring is active before marking done.

## Acceptance criteria

- [ ] `login(admin_user, correct_pw)` → sets real session cookies, user state populated from API
- [ ] Reloading the page while logged in stays logged in (session restored via `GET /api/auth/me`)
- [ ] Visiting a protected route while logged out redirects to `/login`
- [ ] `logout()` calls `POST /api/auth/logout`, clears state, redirects to `/login`
- [ ] Admin nav group hidden for non-admin users
- [ ] Shell visual appearance is unchanged vs sys-pilot
- [ ] No `localStorage` auth checks remain in the guard
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
# Manual: start dev server, navigate to /overview → redirects to /login
# Login with a real PAM user → lands on /overview, username shown in TopBar
# Logout → back to /login
curl -X POST http://localhost:3080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}' -c /tmp/cj.txt -v
curl http://localhost:3080/api/auth/me -b /tmp/cj.txt
```

## Notes / gotchas

- The `cortexos_csrf` cookie is `HttpOnly: false` so the client JS can read it. `cortexos_session` is `HttpOnly: true`. See `02-CONVENTIONS.md` §CSRF.
- PAM runs server-side as root; the client never touches PAM directly.
- `SimulateMenu.tsx` (role switcher) is a mock artifact — safe to remove or no-op the UI; do not leave fake role-switching in production.
- After WP-20 (backend) lands, do a final smoke test against the live server before marking WP-30 complete.
- `_authenticated.tsx` `beforeLoad` runs on both server and client render — guard must be SSR-safe (check cookie / session on server, check API response on client).
