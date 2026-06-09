# WP-20 — API: Auth (Login / Logout / Me)

- **Wave:** 1
- **Depends-on:** WP-01, WP-02
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-13, WP-14, WP-15, WP-16, WP-17, WP-18, WP-19, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/routes/api/auth/`
- **Do NOT touch:** `src/server/auth/` (WP-01 owns this), `src/server/db/`, `src/server/define-api-route.ts`, any other WP's folder

## Objective

Port the three auth endpoints: login (PAM → session create → CSRF cookie), logout (session destroy + cookie clear), and me (return current user). This WP is security-critical — the PAM/session/CSRF flow must be ported exactly. The auth primitives (`SessionStore`, `generateCsrfToken`, `setSessionCookie`, `setCsrfCookie`, `clearSessionCookie`, `clearCsrfCookie`) come from WP-01's `src/server/auth/`. Do not reimplement them here.

## Read first

- **Legacy handlers (primary source — read all three fully):**
  - `packages/dashboard/src/routes/api/auth/login/+server.ts` — full login flow:
    1. Parse `{ username, password }` from request body
    2. `authenticate(username, password)` via `authenticate-pam` — throws on failure
    3. Look up PAM group: `getpwnam` + check `cortexos-admin` group membership via `/etc/group` parse or `execa('id', ['-Gn', username])` — user must be in `cortexos-admin`
    4. `generateCsrfToken()` → 32-byte hex string
    5. `store.createSession({ userId: username, username, csrfToken, ...userInfo })` → `sessionId`
    6. `setSessionCookie(event, sessionId)` — `cortexos_session` HttpOnly Secure SameSite=Strict 30d
    7. `setCsrfCookie(event, csrfToken)` — `cortexos_csrf` non-HttpOnly Secure SameSite=Strict (JS-readable for header injection)
    8. `appendAuditLog(db, { actor: username, surface: 'auth', action: 'login', result: 'success', ... })`
    9. Return `{ user: { id, username, displayName, groups } }`
  - `packages/dashboard/src/routes/api/auth/logout/+server.ts` — logout flow:
    1. Read `sessionId` from `cortexos_session` cookie
    2. `store.deleteSession(sessionId)` — removes from DB
    3. `clearSessionCookie(event)` — sets expired cookie
    4. `clearCsrfCookie(event)` — sets expired cookie
    5. Audit: `action: 'logout'`
    6. Return `{ ok: true }`
  - `packages/dashboard/src/routes/api/auth/me/+server.ts` — current user:
    1. Resolve session via `event.locals.session` (SvelteKit) → in TanStack Start, use `resolveSession(ctx)`
    2. If no session: return `{ user: null }`
    3. Return `{ user: { id, username, displayName, groups } }`
- **Legacy auth module (WP-01 will port this):**
  - `packages/dashboard/src/lib/server/auth/session-store.ts` — `SessionStore`: `createSession`, `getSession`, `deleteSession`, `refreshSession` — backed by `sessions` DB table
  - `packages/dashboard/src/lib/server/auth/csrf.ts` — `generateCsrfToken`, `validateCsrfToken`
  - `packages/dashboard/src/lib/server/auth/cookies.ts` — `setSessionCookie`, `clearSessionCookie`, `setCsrfCookie`, `clearCsrfCookie`
- **Contract section:** `01-API-CONTRACT.md §Auth (WP-20)`

## Steps

1. **Declare login route — `src/routes/api/auth/login/index.ts`:**
   ```
   POST /api/auth/login — auth: 'public' (no session required)
        CSRF: skip (pre-session)
        rateLimit: { limit: 5, windowSec: 60, bucket: 'ip' }
        input: LoginSchema
        → full login flow (see Read first above)
        returns { user: AuthUser }
   ```
   Input schema:
   ```ts
   const LoginSchema = z.object({
     username: z.string().min(1).max(64).regex(/^[a-z_][a-z0-9_-]*$/),
     password: z.string().min(1).max(1024),
   });
   ```
   **Never log `input.password`.** On PAM failure: `appendAuditLog(... result: 'failure', ...)` then throw `permissionError('invalid_credentials')` — do not reveal whether the username exists. On group check failure (user is not in `cortexos-admin`): `permissionError('not_admin')`.

   Group membership check — port from the legacy handler verbatim. One approach:
   ```ts
   import { execFile } from 'node:child_process';
   import { promisify } from 'node:util';
   const execFileAsync = promisify(execFile);
   async function isAdminUser(username: string): Promise<boolean> {
     try {
       const { stdout } = await execFileAsync('id', ['-Gn', username], { timeout: 5000 });
       return stdout.trim().split(/\s+/).includes('cortexos-admin');
     } catch { return false; }
   }
   ```

   Session cookie: `cortexos_session`; CSRF cookie: `cortexos_csrf`. Rolling 30-day session. Cookie flags: `HttpOnly` (session only), `Secure`, `SameSite=Strict`, `Path=/`.

2. **Declare logout route — `src/routes/api/auth/logout/index.ts`:**
   ```
   POST /api/auth/logout — auth: 'any' (session may or may not be present)
        CSRF: required (non-GET with active session)
        → store.deleteSession(sessionId), clearSessionCookie, clearCsrfCookie
        returns { ok: true }
   ```
   If no session cookie present: still return `{ ok: true }` (idempotent — already logged out). Audit only if a session was found and deleted.

3. **Declare me route — `src/routes/api/auth/me/index.ts`:**
   ```
   GET /api/auth/me — auth: 'public' (returns null user if unauthenticated)
       → resolveSession(ctx)
       returns { user: AuthUser | null }
   ```
   No CSRF. No audit. This is a lightweight session probe used by the frontend on load.

   `AuthUser` shape:
   ```ts
   interface AuthUser {
     id: string;          // same as username for PAM users
     username: string;
     displayName: string; // username or gecos field
     groups: string[];    // from the session record
   }
   ```

4. **`defineApiRoute` usage for auth routes:**
   The auth routes are unusual — login and me are `'public'` (no session required). Use `defineApiRoute` with `auth: 'public'` if supported, or bypass the auth check for these specific routes. Check `02-CONVENTIONS.md` for the exact pattern for public routes. The CSRF check must be skipped for login (no session yet) but required for logout.

5. **Audit rows:**
   - Login success: `{ actor: username, surface: 'auth', action: 'auth.login', result: 'success', target: username }`
   - Login failure: `{ actor: username, surface: 'auth', action: 'auth.login', result: 'failure', target: username }`
   - Logout: `{ actor: username, surface: 'auth', action: 'auth.logout', result: 'success' }`
   - me: no audit row (high-frequency probe)

## Acceptance criteria

- [ ] `POST /api/auth/login` with valid PAM credentials + cortexos-admin group → sets `cortexos_session` HttpOnly cookie + `cortexos_csrf` non-HttpOnly cookie; returns `{user:{username,...}}`
- [ ] `POST /api/auth/login` with wrong password → 403 (`invalid_credentials`); audit row `result:'failure'` in DB
- [ ] `POST /api/auth/login` with valid password but user not in `cortexos-admin` → 403 (`not_admin`)
- [ ] `POST /api/auth/login` 6th attempt within 60s → 429 (`rate_limit`)
- [ ] `GET /api/auth/me` with valid session → `{user:{username}}`; without session → `{user:null}`
- [ ] `POST /api/auth/logout` destroys session; subsequent `GET /api/auth/me` → `{user:null}`
- [ ] `POST /api/auth/logout` without CSRF header → 403 (`csrf_invalid`) if session present
- [ ] Session cookie is `HttpOnly`, `Secure`, `SameSite=Strict`; CSRF cookie is non-HttpOnly (readable by JS)
- [ ] `psql` confirms session row created on login and deleted on logout
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# Login
LOGIN=$(curl -s -c /tmp/cx-cookies.txt -X POST http://localhost:3080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"cortexos","password":"<password>"}')
echo $LOGIN | jq .user.username
CSRF=$(grep cortexos_csrf /tmp/cx-cookies.txt | awk '{print $NF}')

# Me (authenticated)
curl -s http://localhost:3080/api/auth/me \
  -b /tmp/cx-cookies.txt | jq .user.username

# Logout
curl -s -X POST http://localhost:3080/api/auth/logout \
  -H "x-csrf-token: $CSRF" \
  -b /tmp/cx-cookies.txt | jq .ok

# Me (unauthenticated after logout)
curl -s http://localhost:3080/api/auth/me | jq .user
# expect null

# Session in DB before and after logout
SESSION_ID=$(grep cortexos_session /tmp/cx-cookies.txt | awk '{print $NF}')
psql $DATABASE_URL -c "SELECT id, user_id, expires_at FROM sessions WHERE id='$SESSION_ID';"
# expect 0 rows after logout

# Rate limit
for i in {1..6}; do
  curl -s -X POST http://localhost:3080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"cortexos","password":"wrong"}' | jq .code
done
# 6th should be rate_limit
```

## Notes / gotchas

- **PAM is blocking** — `authenticate-pam`'s `authenticate()` is a sync call wrapped in a native addon. It blocks the event loop. Wrap in `new Promise` + `setImmediate` or run it in a worker thread if the codebase has a pattern for this. Check how the legacy handler calls it — if it calls synchronously in an async handler, port the same pattern.
- **`cortexos-admin` group check** — PAM authentication succeeds for any valid system user, but only `cortexos-admin` members can log in. The group check happens **after** PAM auth succeeds. This prevents login by any system user. Port the exact group check from the legacy handler.
- **Cookie flags** — `cortexos_session` must be `HttpOnly` (not readable by JS). `cortexos_csrf` must NOT be `HttpOnly` (JS must read it to set `x-csrf-token` header). This is the double-submit CSRF pattern. Get both flags right.
- **Session expiry** — 30-day rolling: on each authenticated request, `refreshSession(sessionId)` extends the expiry. The rolling refresh is handled by the auth middleware in WP-01, not in these route handlers.
- **Login rate limit is by IP** — use `bucket: 'ip'` (not `bucket: 'user'`) to prevent username enumeration via rate limit differences. The IP is from the forwarded header or request IP.
- **Audit on failure** — the login failure audit row must be written even when PAM throws. Use try/catch: attempt PAM, on success proceed to session creation, on failure write audit row then throw `permissionError`.
- **`defineApiRoute` for public routes** — the `auth: 'public'` config tells the wrapper to skip session resolution and CSRF check. The login handler then manually creates the session. The `me` handler manually calls `resolveSession` (which may return null). Check `02-CONVENTIONS.md` §Public routes for the exact pattern.
- **TanStack Start cookie API** — TanStack Start uses `getCookie(event, name)` and `setCookie(event, name, value, options)` from h3. The auth cookie helpers in WP-01 wrap these. Do not call `setCookie` directly in the login route — use the helpers from `src/server/auth/cookies.ts`.
