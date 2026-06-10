# WP-03 — Security cores (portable)
- **Wave:** 0   **Depends-on:** WP-02 (DB schema/types only)   **Parallel-safe-with:** WP-00, WP-04
- **Owns (edit only these):** `packages/dashboard-next/src/server/auth/pam.ts`, `packages/dashboard-next/src/server/approval/**`, `packages/dashboard-next/src/server/audit/**`, `packages/dashboard-next/src/server/env-reveal.ts`, `packages/dashboard-next/src/server/redact.ts`, `packages/dashboard-next/src/server/policy/**`, `packages/dashboard-next/src/server/errors/**`, `packages/dashboard-next/src/server/rate-limit/**`, `packages/dashboard-next/src/server/config.ts`, and the matching `__tests__` for these modules.
- **Do NOT touch:** any `packages/dashboard/**` (legacy), `src/server/define-api-route.ts` (WP-01), `src/server/auth/{session-store,cookies,csrf}.ts` (WP-01), `src/server/db/**` (WP-02).

## Objective
Port the framework-agnostic security primitives verbatim: PAM authenticator, approval token mint/verify/consume (HMAC), append-only audit HMAC chain, env-reveal grants, the command policy allowlist/denylist, the typed error model, the rate limiter, and the server config (cookie names, HMAC key, TTLs). These are pure Node/TS with no SvelteKit coupling. Done = modules compile and the ported unit tests are green (approval single-use, audit chain verify, mask/redact rules, rate-limit window, policy allowlist).

## Read first
- `packages/dashboard/src/lib/server/auth/pam.ts` — exports `GroupName` (`'cortexos-admin'|'cortexos-auditor'|'cortexos-users'`), `PamAuthResult`, `PamAuthFailureReason`, `PamAuthenticator` interface (`authenticate`, `getGroups`, `isAdmin`, `name`), `getPamAuthenticator/setPamAuthenticator/resetPamAuthenticator`, `LinuxPamAuthenticator`, `FakePamAuthenticator`. KEY: coarse failures only (no user-enumeration); `cortexos-admin` is the ONLY admin group (never `sudo`/`wheel`, SR-003); PAM service name from `CORTEX_AUTH_PAM_SERVICE` (default `cortexos-dashboard`); `CORTEX_AUTH_FAKE_PAM=1` forces the fake; non-Linux warns + falls back to fake.
- `packages/dashboard/src/lib/server/approval/index.ts` — `ApprovalClaims`, `actionHashFor(action,payload)` (sorted-key stable JSON → sha256), `mintApproval(input)`, `verifyApproval(token, expectedSessionId)`, `consumeApproval(token, expectedSessionId)` (single-use; checks replay BEFORE session binding), `resetApprovalStore`, `approvalStoreSize`, `_isTokenConsumed`. Token format `v1.<b64url-payload>.<b64url-hmac>`; HMAC key from `getServerHmacKey()`; TTL 60s destructive / 300s reveal.
- `packages/dashboard/src/lib/server/audit/index.ts` — `audit(input)`, `listAudit()`, `verifyAuditChain()`, `AuditInput`, `AuditVerifyResult`, `resetAudit`, plus `_runningHashForTests/_expectedRunningHashAt`. Genesis hash = `sha256("cortexos-audit-genesis")`; chain link = `sha256(id::payloadHash::tsUnixMicros::prevRunningHash)`; row 0 has `prevHash = null`. NOTE: legacy `audit/index.ts` is the in-memory chain math; the DB-backed verify lives in `db/repos/audit.ts` (`verifyAuditLogChain`, `appendAuditLog`, `jcs`) which WP-02 ports — this WP ports the in-memory primitive + its tests.
- `packages/dashboard/src/lib/server/env-reveal.ts` — `REVEAL_TTL_MS/SEC` (10 min), `grantReveal(sessionId)`, `hasRevealGrant(sessionId)`, `revealExpiresAt(sessionId)`, `revokeReveal(sessionId)`, `_resetRevealGrants`. In-memory `Map<sessionId, expiresAtMs>`; grants do NOT survive restart (fail-safe relock).
- `packages/dashboard/src/lib/server/policy/index.ts` — `Surface`, `AllowlistEntry`, `DenyHit`, `allowlistedCommand`, `isCommandAllowed`, `listAllowlistedBySurface`, `addAllowlisted`, `violatesDenylist`, `hasSmugglingPattern`, `validateShellArg`, `resetPolicy`, `installDefaultAllowlist()` (called once on import). Carries the full systemd/docker/incus/terminal/pkg allowlists + `requiresApproval` flags + the `DENY_PATTERNS`/`SMUGGLING_PATTERNS` (T-104). Port verbatim — these are the only thing standing between the UI and arbitrary command execution.
- `packages/dashboard/src/lib/server/rate-limit/index.ts` — `RateLimitConfig`, `RateLimitResult`, `checkRateLimit(cfg)` (sliding window, records only on allow), `ipKey/userKey/rateLimitByIp/rateLimitByUser`, `_resetAllBuckets/_bucketCount`. In-process `Map`.
- `packages/dashboard/src/lib/server/errors/types.ts` — `ApiError` discriminated union (`validation|auth|permission|not_found|rate_limit|approval_required|system`), `isApiError`, and constructors (`validationError`, `authError`, `permissionError`, `notFoundError`, `rateLimitError`, `approvalRequiredError`, `systemError`). This is the canonical error model.
- `packages/dashboard/src/lib/server/errors/index.ts` — `httpStatusFor`, `errorBody`, `jsonError`, `ApiErrorBody`, `ApiErrorThrown`. NOTE: the legacy file is SvelteKit-coupled via `setKitShim`/`apiError`. Port the framework-agnostic parts (`httpStatusFor`, `errorBody`, `jsonError`, `ApiErrorThrown`) and DROP the SvelteKit shim; WP-01 supplies the TanStack throw path. Status map: validation→400, auth→401, permission→403, not_found→404, rate_limit→429, approval_required→412 (NOTE: contract `01` says 412; legacy `httpStatusFor` returns 403 for approval_required — follow `01-API-CONTRACT.md`: 412), system→500.
- `packages/dashboard/src/lib/server/config.ts` — `SESSION_COOKIE`, `CSRF_COOKIE`, `APPROVAL_DEFAULT_TTL_SEC`, `APPROVAL_REVEAL_TTL_SEC`, rate-limit defaults, `getServerHmacKey/setServerHmacKey/setServerHmacKeyFromString`. In M3 the HMAC key loads from `.secrets/` — port as-is (random per-process) and leave a TODO to source `CORTEX_MASTER_KEY` from env in WP-50/cutover.
- redact: there is NO `redact.ts` in legacy today (search shows none). Create a minimal `redact.ts` only if `02-CONVENTIONS.md` (never log secrets; never put secret values in audit `target`) requires a helper used by WP-01; otherwise scaffold a stub `redactPayload(obj)` that strips `password|token|secret|authorization` keys and note it's new. Do NOT invent a complex API.
- Tests to port (legacy `src/lib/server/__tests__/`): `approval.test.ts`, `audit.test.ts`, `policy.test.ts`, `rate-limit.test.ts`, `errors.test.ts`. Also `auth/__tests__/pam-linux.test.ts`.
- `01-API-CONTRACT.md` §Response envelope + §Approvals; `02-CONVENTIONS.md` §Auth model (approval tokens, env-reveal, RBAC).

## Steps
1. Create `src/server/` subfolders and copy each module verbatim: `auth/pam.ts`, `approval/index.ts`, `audit/index.ts`, `env-reveal.ts`, `policy/index.ts`, `rate-limit/index.ts`, `errors/types.ts`, `config.ts`.
2. Port `errors/index.ts` WITHOUT the SvelteKit shim: keep `httpStatusFor`, `errorBody`, `jsonError`, `ApiErrorBody`, `ApiErrorThrown`; delete `setKitShim`/`requireShim`/`apiError`. Change `httpStatusFor` for `approval_required` to **412** per `01-API-CONTRACT.md` (and keep the `retry-after` header for rate_limit). Update `jsonError`'s approval-required headers to also expose `action`/`ttlSec` per `01`.
3. Rewrite import specifiers from `$lib/server/...` to relative `../...`. `pam.ts` imports types from `../entities`/contracts — point them at `@cortexos/contracts` where applicable; the `GroupName` union is defined in `pam.ts` itself, keep it.
4. `approval/index.ts` imports `getServerHmacKey` from `../config` and `ApprovalToken`/`SessionId` types — wire to the ported `config.ts` and `@cortexos/contracts` (`ApprovalToken`) / contracts primitives (`SessionId`).
5. `audit/index.ts` imports `AuditEvent`/`SessionId`/`UserId` + `asAuditEventId` — source these from `@cortexos/contracts` (confirm the `asAuditEventId` brand helper exists there; if not, port the legacy `entities` helper into a local `entities`-shim used only by audit, and note it).
6. Port the unit tests for each module, adjusting only imports. They are the acceptance gate.

## Acceptance criteria
- [ ] All listed modules compile under TS strict.
- [ ] Ported unit tests green: approval single-use (`consumeApproval` second call → `already_used`), session-mismatch rejection, expiry; audit chain verify ok + tamper detection; policy allowlist + denylist + `validateShellArg` smuggling cases; rate-limit window allow/deny; error status mapping (approval_required → 412 per `01`).
- [ ] `cortexos-admin` is the only admin-bearing group; `sudo`/`wheel` never grant admin.
- [ ] No secrets logged; redact helper (if created) strips secret-shaped keys.
- [ ] no edits outside OWNS (legacy untouched; WP-01/WP-02 files untouched).

## Verification commands
```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next test -- approval audit policy rate-limit errors pam
```

## Notes / gotchas
- `httpStatusFor(approval_required)` differs between legacy (403) and the frozen contract (412). Follow `01-API-CONTRACT.md` → **412**. Flag this in `STATUS.md` since WP-16/WP-18 depend on it.
- All token/approval/audit/env-reveal stores are in-memory and process-wide; the app is a single Node process (matches legacy). Do NOT add Redis/DB persistence here.
- `getServerHmacKey()` is random per-process today — approval tokens and audit chains do not survive a restart by design. WP-50/cutover will source a stable `CORTEX_MASTER_KEY`; leave the TODO, don't implement env-loading here.
- The policy module runs `installDefaultAllowlist()` at import time (side effect). Preserve that so importers get the allowlist populated.
- PAM is Linux-only via `authenticate-pam` (native binding, root). On dev/CI it falls back to `FakePamAuthenticator` (accepts anything, treats all as admin) — never let the fake run in production; the Linux branch is automatic on the host.
