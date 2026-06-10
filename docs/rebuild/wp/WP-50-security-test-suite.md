# WP-50 — Security test suite (CUTOVER GATE)
- **Wave:** 3   **Depends-on:** WP-01, WP-03, WP-10–WP-21 (all Wave 1)   **Parallel-safe-with:** WP-51 (read-only parity work)
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/**/__tests__/`
  - `packages/dashboard-next/src/routes/api/**/__tests__/`
  - `packages/dashboard-next/src/server/__tests__/security.spec.ts` (new integration spec)
- **Do NOT touch:** any production source file; `packages/dashboard` (legacy); `docs/rebuild/`

## Objective

Port and extend the legacy vitest security tests so every security property of
the new TanStack/Node server is verified. **All tests must be green before WP-52
begins.** This WP is the sole cutover gate; WP-52 must not start until
`STATUS.md` records this WP as `done`.

## Read first

| File | Why |
|------|-----|
| `packages/dashboard/src/lib/server/__tests__/approval.test.ts` | Port verbatim: mint, verify, single-use, session-binding, replay |
| `packages/dashboard/src/lib/server/__tests__/audit.test.ts` | Port verbatim: HMAC chain append, tamper detection, payload-hash stability |
| `packages/dashboard/src/lib/server/__tests__/auth.test.ts` | Port: requireAuth/requireAdmin/requireGroup, 401/403 paths |
| `packages/dashboard/src/lib/server/__tests__/rate-limit.test.ts` | Port: burst throttle, window expiry, key isolation |
| `packages/dashboard/src/lib/server/__tests__/routes.test.ts` | Port: per-route RBAC audit (PB-1…PB-6), approval gating, allowlist gating |
| `packages/dashboard/src/lib/server/auth/__tests__/pam-linux.test.ts` | Port: LinuxPamAuthenticator surface, getGroups, isAdmin, singleton |
| `packages/dashboard/src/lib/server/auth/__tests__/session-store-drizzle.test.ts` | Port: createSession, resolveByToken, touch, sweepExpired, revalidateRole |
| `packages/dashboard/src/routes/api/env-browser/__tests__/api-env-browser.test.ts` | Port + extend: masked-by-default, no cross-session leak |
| `packages/dashboard/src/routes/api/approvals/__tests__/approvals-mint-api.test.ts` | Port: admin-only mint |
| `packages/dashboard/src/routes/api/approvals/__tests__/approvals-grant-revoke-api.test.ts` | Port: grant/revoke |
| `02-CONVENTIONS.md` §Auth model | Canonical security requirements |
| `01-API-CONTRACT.md` §Auth levels, §Rate limits | Rate-limit defaults per endpoint |

## Security properties to verify (exhaustive)

### 1. PAM login — `src/server/__tests__/security.spec.ts` §pam
- Success path: valid credentials → session created, `cortexos_session` cookie set, `cortexos_csrf` cookie set.
- Failure path: bad password → `{code:"auth"}` 401, **no user-enumeration** (same response shape for unknown username vs wrong password).
- Empty username/password → 400 before PAM is called (`LinuxPamAuthenticator` short-circuits).
- `CORTEX_AUTH_FAKE_PAM=1` activates the fake backend (dev/test safety valve).

### 2. Session resolution + rolling expiry — ported from `session-store-drizzle.test.ts`
- `createSession` persists user + session row; returns 43-char token.
- `resolveByToken` returns null for unknown token, null for expired session.
- `touch` extends `expiresAt`; caps at `createdAt + ttlMs`; returns null for expired session.
- `sweepExpired` deletes only expired rows.
- `revalidateRole` flips `isAdmin` and bumps `lastRoleCheckAt`.
- `gcExpired` returns `{deleted, ranAt}`.

### 3. CSRF double-submit — `src/server/__tests__/security.spec.ts` §csrf
- GET request without `x-csrf-token` header: allowed (CSRF only checked on non-GET).
- POST request without `x-csrf-token` header: 403 `{code:"auth"}`.
- POST with header value mismatched from cookie: 403.
- POST with correct header matching cookie: passes CSRF check.

### 4. RBAC admin gating — ported from `auth.test.ts` + `routes.test.ts`
- `requireAuth` → 401 when no session; 401 for inactive user; returns user when authed.
- `requireAdmin` → 403 for authenticated non-admin; 401 for unauthenticated; returns user for admin.
- `requireGroup` → 403 when not in group; 200 when in group.
- `isAdmin` trusts `cortexos-admin` group membership, NOT `sudo`/`wheel`.
- Per PB-6: all privileged POST routes (`/api/approvals`, `/api/terminal`, `/api/docker/actions`, `/api/systemd/actions`, `/api/incus/actions`) return 403 for a non-admin authenticated user.

### 5. Approval token — single-use + session/action binding — ported from `approval.test.ts`
- `mintApproval` returns token matching `/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/`.
- `verifyApproval` with wrong `sessionId` → `{ok:false, reason:"session_mismatch"}`.
- `verifyApproval` with unknown token → `{ok:false, reason:"signature"}`.
- `verifyApproval` with tampered signature → `{ok:false, reason:"signature"}`.
- Malformed token (wrong shape) → `{ok:false, reason:"malformed"}`.
- `consumeApproval` first call → `{ok:true}`; second call (same token) → `{ok:false, reason:"already_used"}`.
- Cross-session replay after consume → `{ok:false, reason:"already_used"}`.
- Non-admin cannot call `POST /api/approvals` → 403 (PB-1 fix).

### 6. Env-browser — masked-by-default + PAM-unlock grant + no cross-session leak — ported from `routes.test.ts` §PB-3 + `api-env-browser.test.ts`
- Admin `GET /api/env-browser` without a reveal grant → 200, `revealed:false`, all values masked (cleartext absent from response body, SR-071).
- Non-admin `GET /api/env-browser` → 403.
- Admin `GET` with path outside the allowlist → 403.
- `POST /api/env-browser/unlock` with wrong password → 401 from PAM.
- After successful unlock, a `GET` in the **same session** returns `revealed:true` with cleartext values.
- A `GET` in a **different session** (different `sessionId`) during an active grant still returns `revealed:false` (no cross-session leak).
- Grant expires after 10 min (TTL=600s); subsequent `GET` returns `revealed:false`.

### 7. Rate limits — ported from `rate-limit.test.ts`
- `checkRateLimit` allows first N, blocks N+1 with `retryAfterSec > 0`.
- Window expiry: after window elapses, requests are allowed again.
- Burst of 100 past 100/min cap → rejected.
- Token-mint endpoint capped at 30/min (SR-200).
- Per-IP and per-user keys are independent (key isolation).
- `POST /api/env-browser/unlock` rate-limited at 5/min per user (env-unlock bucket).

### 8. Audit HMAC chain — ported from `audit.test.ts`
- First row has `prevHash=null`.
- Subsequent rows have non-null `prevHash`.
- `verifyAuditChain()` returns `{ok:true, length:N}` for an intact chain.
- Tampering with any row's `prevHash` → `{ok:false, index:N}` at the tampered position.
- Payload hash is order-independent (sorted-key JSON).
- `GET /api/audit/verify` (admin) returns `{ok:true}` against a fresh chain; non-admin → 403.

### 9. Allowlist gating — ported from `routes.test.ts` §PB-2, §PB-4, §PB-5
- `POST /api/terminal` with non-allowlisted op → 400; with `bash -c <userstring>` → 400; with arg-smuggling `$(id)` → 400 (T-104).
- `POST /api/incus/[name]/exec-named` with non-allowlisted op → 400; non-admin → 403.
- `POST /api/docker/actions` with allowlisted action → 200; with `rm` (destructive) → 412 `approval_required`; with invalid container name → 400 (SR-030).
- `POST /api/systemd/actions` with `restart cortex-dashboard.service` → 412 (approval required); with Cyrillic unit name → 400 (SR-030).
- `POST /api/incus/actions` with `delete` → 412; with non-allowlisted profile → 400 (SR-052).

## Steps

1. Create `packages/dashboard-next/src/server/__tests__/` directory structure mirroring the legacy layout.
2. Port `approval.test.ts` → `src/server/__tests__/approval.test.ts`. Update imports from the new `src/server/approval/` module paths. Keep all describe/it names identical.
3. Port `audit.test.ts` → `src/server/__tests__/audit.test.ts`. Update imports from `src/server/audit/`. Keep all describe/it names.
4. Port `auth.test.ts` → `src/server/__tests__/auth.test.ts`. Update imports from `src/server/auth/`. Adapt `makeFakeEvent`/`makeFakeLocals` to TanStack request context shape.
5. Port `rate-limit.test.ts` → `src/server/__tests__/rate-limit.test.ts`. Update imports from `src/server/rate-limit`.
6. Port `pam-linux.test.ts` → `src/server/auth/__tests__/pam-linux.test.ts`. Keep the `node:child_process` mock; update module import path.
7. Port `session-store-drizzle.test.ts` → `src/server/auth/__tests__/session-store-drizzle.test.ts`. Wire to the new `src/server/db/test-utils` (PGlite helper from WP-02).
8. Write `src/server/__tests__/security.spec.ts` — new integration spec covering §pam, §csrf, §env-browser cross-session, §rate-limit env-unlock. Use `defineApiRoute` test harness (from WP-01).
9. Port route-level tests: `src/routes/api/**/__tests__/` for approvals, docker/actions, systemd/actions, incus/actions, terminal, env-browser. Keep describe/it names; adapt to TanStack handler signatures.
10. Run `pnpm --filter @cortexos/dashboard-next test` — fix any import mismatches until all pass.
11. Update `STATUS.md`: `WP-50 done — N tests passing`.

## Acceptance criteria

- [ ] Every security property in §2–§9 above has at least one passing test.
- [ ] `pnpm --filter @cortexos/dashboard-next test` exits 0 with zero failed suites.
- [ ] No test uses `vi.mock` to skip the real auth/approval/rate-limit logic (mocks of PAM native binding and `execFile` are allowed).
- [ ] `STATUS.md` updated; WP-52 agent must check this before proceeding.
- [ ] No edits outside OWNS.

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next test --reporter=verbose 2>&1 | tail -30
pnpm --filter @cortexos/dashboard-next test --coverage 2>&1 | grep -E "security|approval|audit|rate-limit|pam|session"
```

## Notes / gotchas

- The TanStack `defineApiRoute` wrapper (WP-01) wraps handlers; tests call handlers directly via a test-harness helper — replicate the `makeFakeEvent` / `callHandler` pattern from `routes.test.ts` adapted for TanStack's `Request`/`Response` API.
- `DrizzleSessionStore` requires a PGlite test DB (`src/server/db/test-utils`); ensure `createTestDb` is ported by WP-02 before running session tests.
- `LinuxPamAuthenticator.authenticate()` success path requires the `authenticate-pam` native binding; mock it in CI exactly as the legacy `pam-linux.test.ts` does — do NOT attempt a real PAM call in tests.
- Never log or assert on raw password values in test output.
- Rate-limit bucket state is global; call `_resetAllBuckets()` in `beforeEach`.
- Approval store state is global; call `resetApprovalStore()` in `beforeEach`.
- HMAC key must be seeded: call `setServerHmacKeyFromString('test-key-1234567890')` in `beforeEach`.
