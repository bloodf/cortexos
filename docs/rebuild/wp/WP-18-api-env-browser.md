# WP-18 — API: Env Browser

- **Wave:** 1
- **Depends-on:** WP-01, WP-02
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-13, WP-14, WP-15, WP-16, WP-17, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/env-browser/`
  - `packages/dashboard-next/src/routes/api/env-browser/`
- **Do NOT touch:** `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, any other WP's folder

## Objective

Port the env-browser endpoints: a masked GET that reads `.env` files from allowlisted directories, and a PAM re-authentication unlock that grants a 10-minute reveal window. While the grant is active, GET returns cleartext values; otherwise secret keys are masked. No mutation of env files. This WP is security-critical: never log secret values, never return masked and unmasked values from the same call for non-granted sessions.

## Read first

- **Legacy handlers (primary source — read both fully):**
  - `packages/dashboard/src/routes/api/env-browser/+server.ts` — full GET logic:
    - `ALLOWED_PREFIXES`: `['/opt/cortexos/.secrets/', '/opt/cortexos/stacks/']`
    - `maskValue(key, value)` — uses `SECRET_KEY_RE` to detect secret keys
    - `realpath()` resolution — validates the resolved path still starts with an allowed prefix (symlink escape prevention)
    - `hasRevealGrant(sessionId)` — if live, returns cleartext; otherwise `maskValue()` on secret-looking keys
    - Returns `{files: EnvFile[], revealExpiresAt?: number}`
  - `packages/dashboard/src/routes/api/env-browser/unlock/+server.ts` — PAM unlock:
    - Rate-limited: `{ limit: 5, windowSec: 60, bucket: 'user' }`
    - Reads `{ password }` from request body — **never log this field**
    - PAM re-auth: `authenticate(user.username, password)` (same PAM module as login)
    - On success: `grantReveal(sessionId)` → returns `{ok: true, expiresAt: revealExpiresAt(sessionId)}`
    - On failure: throw `permissionError` (do not reveal whether user exists)
- **Legacy env-reveal module (primary source — read fully):**
  - `packages/dashboard/src/lib/server/env-reveal.ts`:
    - `REVEAL_TTL_MS = 10 * 60 * 1000` (10 minutes)
    - In-memory `Map<string, number>` (`sessionId` → `expiresAtMs`)
    - `grantReveal(sessionId)`, `hasRevealGrant(sessionId)`, `revealExpiresAt(sessionId)`, `revokeReveal(sessionId)`
    - `hasRevealGrant` must check `Date.now() < expiresAtMs` and delete expired entries on check
- **Contract section:** `01-API-CONTRACT.md §Env-Browser (WP-18)`

## Steps

1. **Port `src/server/env-browser/reveal.ts`** — copy from `packages/dashboard/src/lib/server/env-reveal.ts`. Update imports (no SvelteKit-specific imports). Keep `REVEAL_TTL_MS`, `grantReveal`, `hasRevealGrant`, `revealExpiresAt`, `revokeReveal` exactly. No DB — this is an in-memory per-process grant store.

2. **Create `src/server/env-browser/reader.ts`** — env file reader:
   ```ts
   import fs from 'node:fs';
   import path from 'node:path';
   
   export const ALLOWED_PREFIXES = ['/opt/cortexos/.secrets/', '/opt/cortexos/stacks/'];
   
   export const SECRET_KEY_RE = /(?:password|passwd|secret|token|key|api[_-]?key|auth|credential|private|pw\b)/i;
   
   export function maskValue(key: string, value: string): string {
     return SECRET_KEY_RE.test(key) ? '***' : value;
   }
   
   export function validatePath(requestedPath: string): string {
     // Resolve symlinks; throws if file does not exist
     const resolved = fs.realpathSync(requestedPath);
     const ok = ALLOWED_PREFIXES.some(prefix => resolved.startsWith(prefix));
     if (!ok) throw new Error(`path_not_allowed: ${resolved}`);
     return resolved;
   }
   
   export interface EnvEntry { key: string; value: string; masked: boolean; }
   export interface EnvFile { path: string; entries: EnvEntry[]; error?: string; }
   
   export function readEnvFile(filePath: string, reveal: boolean): EnvFile {
     try {
       const resolved = validatePath(filePath);
       const raw = fs.readFileSync(resolved, 'utf8');
       const entries: EnvEntry[] = raw.split('\n').flatMap(line => {
         const trimmed = line.trim();
         if (!trimmed || trimmed.startsWith('#')) return [];
         const eqIdx = trimmed.indexOf('=');
         if (eqIdx < 0) return [];
         const key = trimmed.slice(0, eqIdx).trim();
         const rawVal = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
         const isSensitive = SECRET_KEY_RE.test(key);
         return [{ key, value: (reveal || !isSensitive) ? rawVal : maskValue(key, rawVal), masked: !reveal && isSensitive }];
       });
       return { path: filePath, entries };
     } catch (err: unknown) {
       return { path: filePath, entries: [], error: (err as Error).message };
     }
   }
   ```
   Port `SECRET_KEY_RE` and `maskValue` verbatim from the legacy handler — do not change the regex.

3. **Create `src/server/env-browser/index.ts`** — re-exports for use by routes:
   ```ts
   export * from './reader';
   export * from './reveal';
   ```

4. **Declare GET route — `src/routes/api/env-browser/index.ts`:**
   ```
   GET /api/env-browser — auth: admin
       query: { paths?: string[] }   // the .env files to read
       → for each path: validatePath(p), readEnvFile(p, hasRevealGrant(sessionId))
       returns {
         files: EnvFile[],
         revealActive: boolean,
         revealExpiresAt: number | null
       }
   ```
   Input validation: `paths` must be a non-empty array of strings; each string must not be empty. Reject any path that does not start with one of `ALLOWED_PREFIXES` **before** calling `realpath` (belt-and-suspenders: the `validatePath` function also checks post-resolve, but fail early). Reject `..` or `//` in any path segment.

   If `paths` is not provided, scan all `.env*` files under `ALLOWED_PREFIXES` using `fs.readdirSync` (top-level only, no recursion). Cap at 50 files.

   `hasRevealGrant(sessionId)` uses `ctx.session.id` from the `defineApiRoute` context.

5. **Declare unlock route — `src/routes/api/env-browser/unlock/index.ts`:**
   ```
   POST /api/env-browser/unlock — auth: admin
        rateLimit: { limit: 5, windowSec: 60, bucket: 'user' }
        input: { password: string }
        → authenticate(ctx.user.username, input.password)
          on success: grantReveal(ctx.session.id), return {ok:true, expiresAt}
          on failure: throw permissionError('pam_auth_failed')
   ```
   Input schema:
   ```ts
   z.object({
     password: z.string().min(1).max(1024),
   })
   ```
   **Never log `input.password`. Never log the PAM error detail.** On any PAM error, throw `permissionError` — do not surface the error message to the client.

6. **Auth / audit:**
   - Both routes: `auth: 'admin'`, `surface: 'env-browser'`
   - GET action: `'env-browser.read'`
   - POST unlock action: `'env-browser.unlock'`
   - Audit `target` for GET: list of requested paths (safe, no values). **Never put env values in audit target.**

## Acceptance criteria

- [ ] `GET /api/env-browser?paths[0]=/opt/cortexos/.secrets/dashboard.env` returns `{files:[{path, entries}]}` with `masked: true` on secret keys (PASSWORD, TOKEN, KEY, etc.)
- [ ] Same GET after `POST /api/env-browser/unlock` with correct password returns `masked: false` on all entries; `revealActive: true`
- [ ] `GET /api/env-browser` with no `paths` param scans `ALLOWED_PREFIXES` and returns discovered `.env*` files
- [ ] `GET /api/env-browser?paths[0]=/etc/passwd` → 400/403 (path not in allowed prefixes)
- [ ] `GET /api/env-browser?paths[0]=/opt/cortexos/.secrets/../../etc/passwd` → 400/403 (traversal blocked by `..` check and realpath check)
- [ ] `POST /api/env-browser/unlock` with wrong password → 403 (`pam_auth_failed`); rate-limited after 5 attempts
- [ ] `POST /api/env-browser/unlock` with correct password → `{ok:true, expiresAt}` within 10 min of now
- [ ] `revealActive` goes false after `REVEAL_TTL_MS` (10 min); no persistent state leak between server restarts
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# Masked read (no grant)
curl -s "http://localhost:3080/api/env-browser?paths[]=/opt/cortexos/.secrets/dashboard.env" \
  -b "cortexos_session=$SESSION" | jq '[.files[0].entries[] | select(.masked==true) | .key] | length'
# expect > 0 (some keys are masked)

# Unlock (PAM re-auth)
curl -s -X POST http://localhost:3080/api/env-browser/unlock \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"password":"<admin-password>"}' | jq '{ok, expiresAt}'

# Cleartext read after unlock
curl -s "http://localhost:3080/api/env-browser?paths[]=/opt/cortexos/.secrets/dashboard.env" \
  -b "cortexos_session=$SESSION" | jq '.revealActive'
# expect true

# Path traversal blocked
curl -s "http://localhost:3080/api/env-browser?paths[]=/opt/cortexos/.secrets/../../etc/passwd" \
  -b "cortexos_session=$SESSION" | jq .code
# expect path_not_allowed or validation error

# Rate limit check (5 bad attempts)
for i in {1..6}; do
  curl -s -X POST http://localhost:3080/api/env-browser/unlock \
    -H "Content-Type: application/json" -H "x-csrf-token: $CSRF" \
    -b "cortexos_session=$SESSION" \
    -d '{"password":"wrong"}' | jq .code
done
# 6th should be rate_limit
```

## Notes / gotchas

- **`REVEAL_TTL_MS = 10 * 60 * 1000`** — 10 minutes exactly. The in-memory grant Map is per-process; a server restart revokes all grants silently (correct behaviour — user must re-authenticate).
- **`hasRevealGrant` expiry check** — the legacy implementation deletes the expired entry on check (`if (Date.now() >= expiresAtMs) { map.delete(sessionId); return false; }`). Port this exact pattern — do not return `true` for an expired grant.
- **`SECRET_KEY_RE` is load-bearing** — the regex `/(?:password|passwd|secret|token|key|api[_-]?key|auth|credential|private|pw\b)/i` determines which keys are masked. Copy it character-for-character from the legacy handler. Do not simplify or expand.
- **`realpath` before prefix check** — always call `fs.realpathSync` before the prefix check. A symlink like `/opt/cortexos/.secrets/link → /etc/shadow` would pass a naive `startsWith` check; `realpath` resolves it first.
- **PAM import** — `authenticate` is from `authenticate-pam` (Node native addon). The package is already in the monorepo's dependencies (used by the auth bridge). Import it the same way as `packages/dashboard/src/routes/api/auth/login/+server.ts`.
- **Never log secrets** — `input.password` must not appear in any log, audit row, or error message. The PAM error (if any) must not be forwarded to the HTTP response body.
- **Rate limit bucket** — use `bucket: 'user'` (per authenticated user) not `bucket: 'ip'` for the unlock endpoint, to prevent one user from locking out another via the same IP.
- **`paths[]` query param encoding** — TanStack Start query parsing: `?paths[]=foo&paths[]=bar` or `?paths[0]=foo&paths[1]=bar`. Parse with `z.array(z.string())` via `defineApiRoute`'s query schema.
- **No file writes** — this WP reads `.env` files only. Never implement write or delete endpoints here.
