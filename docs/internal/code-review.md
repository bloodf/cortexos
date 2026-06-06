# CortexOS v1.0 — Pre-release Code Review

**Reviewed:** 2026-05-16
**Scope:** Dashboard secrets IO, AI plumbing, OpenClaw client, migrations, audit + auth API routes, cortex-consumer
**Plan ref:** `/Users/heitor/.claude/plans/we-are-about-to-modular-charm.md` (v3)
**Mode:** report-only — no source edits

---

## Verdict

**Changes required before live VPS rebuild.** Two CRITICAL items, six HIGH, several MEDIUM. The core security primitives (HMAC token binding, path allow-list, atomic env write, JetStream durable + DLQ, breaker, JCS+HMAC NATS signing, replay-nonce KV) are well-engineered and match the plan. The blockers are at the **trust boundary plumbing** between those primitives — token-not-bound-to-user, missing admin-role gate, missing DB grants, and one read-after-rename TOCTOU.

---

## Cross-cutting sweep results

| Sweep | Expected | Actual |
|---|---|---|
| `3guns|mementry|celebrar|cieucpb` in tracked sources | zero | **zero** in tracked tree; matches only inside `.secrets/` (gitignored). ✅ |
| `ALTER TABLE` in `dashboard/migrations/` | zero | **zero**. ✅ |
| `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@anthropic-ai`, `from 'openai'` | zero | **zero**. ✅ Only `@ai-sdk/openai-compatible`. |
| Version pins (`@x.y.z`) in `prompts/tools/4[0-9]-openclaw*.md` | zero | **zero**. ✅ |
| `REVOKE`/`GRANT` for `agent_gateway_audit` append-only | present | **missing**. See HIGH-3. |

---

## CRITICAL

### CR-1 — Confirmation token not bound to user/session identity
**File:** `dashboard/src/lib/ai/confirmation-token.ts:148-149` (canonicalMessage)
**File:** `dashboard/src/app/api/env-browser/route.ts:172-177` (verify call)

The HMAC payload is `sessionId|toolName|argsHash|nonce|expiresAtIso`. `IssueInput` accepts `userId` (line 52) but **never folds it into the MAC**. Worse, `/api/env-browser` POST passes `sessionId: auth.session?.token` (line 175) — the raw session cookie. Result:

1. If an attacker exfiltrates an issued token + the issuer's session cookie value (e.g., browser XSS, log leak, audit-row leak of `session_id`), they can replay on any path under the same env-write tool because nothing binds the token to the *current* authenticated user except possession of the session token itself, which the attacker already has.
2. More importantly, the *chat-issued* token uses `sessionId = ctx.sessionId` from chat request body (route.ts:90 — `sessionId: z.string().min(1)` — caller-controlled). A client can pick its own sessionId, get a token issued, then submit a write to `/api/env-browser` whose `sessionId` field is `auth.session?.token`. The two strings differ — verify will already fail. **Cross-issue/verify channel mismatch is a separate bug (see CR-2)**, but the underlying defect is the same: identity is not in the MAC.

**Impact:** Token forgery resistance hinges on `sessionId` value being secret + per-user. It is neither bound to `user_id` nor consistently sourced. Privilege escalation between users is possible if an admin's chat-issued token leaks via audit row (audit stores `session_id`).

**Fix:**
- Include `userId` in `canonicalMessage`: `${userId}|${sessionId}|${toolName}|${argsHash}|${nonce}|${expiresAtIso}`.
- Accept `userId` in `VerifyInput`; require callers to pass authenticated `auth.session.user_id`, not the cookie token.
- Add a stable per-user `sessionId` server-side (e.g., `auth.session.user_id + ':' + auth.session.token` hashed) and stop trusting client-supplied `sessionId` for token issuance.

---

### CR-2 — Confirmation tokens issued in `/api/ai/chat` cannot be redeemed at `/api/env-browser`
**File:** `dashboard/src/app/api/ai/chat/route.ts:180` — tools constructed with `sessionId: parsed.sessionId` (client-supplied)
**File:** `dashboard/src/lib/ai/tools.ts:164-170` — token issued with `ctx.sessionId`
**File:** `dashboard/src/app/api/env-browser/route.ts:174` — token verified with `sessionId: auth.session?.token`

The chat path issues tokens keyed on the **client-chosen sessionId string**, but the env-browser POST verifies with **the bearer/cookie session token**. They will never match. The env-write flow is effectively broken end-to-end: every confirmation handed back through chat is unredeemable at the writer endpoint, and vice-versa.

**Plan reference §4a** explicitly states: "for privileged/destructive tool calls, server issues a `confirmation_token = HMAC(session_id || args_hash || tool || nonce)` ... UI must echo the token in the follow-up confirm; server verifies HMAC + match + TTL + single-use before executing." The "session_id" must be the same identifier on both sides.

**Fix:** Pick one canonical session identifier (recommend: derived from `auth.session.user_id + auth.session.token`, hashed) and use it in both endpoints. Drop `sessionId` from request body schemas; derive server-side.

---

## HIGH

### H-1 — No admin-role gate on `/api/ai/chat` (and elsewhere)
**File:** `dashboard/src/lib/auth.ts:105-135`
**File:** `dashboard/src/app/api/ai/chat/route.ts:104-117`

`requireAuth` returns ok for any non-expired session — there is no `is_admin` check, no role column on `admin_users` (verified in `001_schema.sql:143-148`). Plan §4a requires: "Admin role gate (403 + audit on non-admin)". Today every authenticated user is implicitly admin. This is the only auth surface, so functionally it works on a single-operator VPS — but the moment the operator creates a second account (admin/users API exists at line 33 of `/api/admin/users/route.ts`), that account has full destructive tool access.

**Fix:** Either (a) document and enforce single-account by rejecting `createUser` when `count(users) >= 1`; or (b) add `admin_users.is_admin BOOLEAN NOT NULL DEFAULT false` to `001_schema.sql`, first user becomes admin, gate `/api/ai/chat`, `/api/env-browser` POST, `/api/admin/users`, `/api/projects` mutations, `/api/audit` on `is_admin = true`. Audit decision='deny' on non-admin.

### H-2 — `env-browser` GET reveals cleartext without confirmation token
**File:** `dashboard/src/app/api/env-browser/route.ts:62-99`

The `reveal=true` branch returns plaintext secret values to any authenticated caller after writing an audit row. There is **no confirmation-token requirement** for cleartext reads, only for writes. Plan §3.5: "All reads of masked values, all writes → `agent_gateway_audit` entry with before/after sha256." The plan allows audit on reveal-on-click; the implementation honors that. But the broader v1 invariant ("Cortex is helper, not god; destructive-class requires confirm + cooldown") arguably implies that cleartext exfil of e.g. `OPENCLAW_GATEWAY_TOKEN`, `CORTEX_NATS_HMAC`, `NINEROUTER_API_KEY` should be at least *privileged with confirmation*, not implicit on auth.

**Fix:** Treat `reveal=true` as `tool_class='privileged'` requiring `X-Cortex-Confirmation-Token`. Bind token to `path + sorted(keys)`. Already lays out the audit; just add the token gate to match POST.

### H-3 — `agent_gateway_audit` append-only is documented but **not enforced** by grants
**File:** `dashboard/migrations/001_schema.sql:110-111` (comment only)

The schema carries a `COMMENT ON TABLE ... 'Dashboard app role must have INSERT,SELECT only; REVOKE UPDATE,DELETE at deploy.'` but no `REVOKE` statement runs. `deploy.sh --fresh` will not enforce this. If the dashboard service user is compromised, audit history is mutable, defeating the entire forensic trail.

**Plan §4a:** "Append-only (no UPDATE/DELETE via DB role; enforced by app + DB grants)." The grant side is unmet.

**Fix:** Add at end of `001_schema.sql` (after table creation, before INSERT migrations row):
```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard') THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON agent_gateway_audit FROM dashboard';
    EXECUTE 'GRANT INSERT, SELECT ON agent_gateway_audit TO dashboard';
  END IF;
END$$;
```
Document the role name and `migrations/001` ordering so the role exists before this runs (move it to a `_grants.sql` step after seed if needed). Verify in Phase 6 smoke that `UPDATE agent_gateway_audit ... ` fails as the `dashboard` role.

### H-4 — vps-writer: post-rename re-read TOCTOU and inconsistent permission preservation
**File:** `dashboard/src/lib/secrets/vps-writer.ts:227-237`

The flow is: write `.tmp` → `chmod` → `chown` → `rename` → re-read final content for `afterSha256`. Between `rename(2)` and the re-read, another process can replace the file (or modify it). The `afterSha256` then describes someone else's content, but is recorded into audit as the verified result of *this* write. The lock is released *after* the re-read in finally, so internal callers are safe — but external writers under the path (sudo helper, operator vim, etc.) are not blocked.

Also: `chmod(tmpPath, mode)` runs after `writeFile(tmpPath, ..., { mode })` (line 229-230) — `writeFile` already applied umask-respecting mode; the second `chmod` masks that, but if the tmp file already exists with looser perms (umask race), there is a window where contents are world-readable before chmod fires. Use `fs.open(path, 'wx', mode)` then `writeFile(handle, content)` instead.

**Fix:**
- Compute `afterSha256` from the in-memory `nextContent` buffer, not by re-reading. The contract is "what we wrote", not "what is on disk now".
- Or, alternatively, `fsync` the dir after rename and `fs.open(path, 'r')` with the same lock held, hash from the fd.
- Open tmp with `O_CREAT|O_EXCL|O_WRONLY` and explicit mode in one syscall.

### H-5 — In-memory rate limiter resets on every dashboard restart and on every Next.js route-segment reload
**File:** `dashboard/src/app/api/ai/chat/route.ts:42-73`

`userBuckets` + `globalBucket` are module-scope. In dev (hot reload) and across redeploys, the bucket flushes. Also, Next.js route handlers can run in multiple worker contexts; the bucket is per-process, so the "global 300/15min" cap is per-process not per-cluster. Plan §4a names exact numbers (60/15 per user, 300/15 global). On the single-node systemd deploy this is acceptable, but it must be documented as such.

The comment line 6-7 ("TODO: swap for Redis/Valkey-backed store once cortex-consumer is wired") acknowledges this. Promote it from TODO to a tracked v1.1 ticket and add a startup log line on first request so operators see the in-memory note. Acceptable for v1.0 single-node — flag for documentation.

**Fix:** Add `process.stdout.write` once at module load: `[ratelimit] in-memory, per-process; multi-node deploys must front-end with Redis`.

### H-6 — `chat_sessions` schema has no per-message integrity, retention, or admin lookup gate
**File:** `dashboard/migrations/001_schema.sql:217-223`

`messages jsonb` grows unbounded. No retention job, no row count cap, no per-message size limit enforced. Plan §1: "Chat state stored server-side (postgres `chat_sessions` per user, redacted tool outputs)" — but the schema persists whatever `appendChatMessages` writes (line 165 of chat route writes raw user content). If a tool result containing a leaked secret ever lands in `assistant` content, it persists indefinitely. The path "redacted tool outputs" is not enforced anywhere in code.

**Fix:**
- Add CHECK constraint `length(messages::text) < 1_000_000` or similar
- Add 003_retention-style cleanup for `chat_sessions.messages` beyond N days
- Add a redaction pass in `appendChatMessages` that strips obvious secret patterns from `content` (mirror `MASK_PATTERN` from vps-reader)
- Document in `docs/SECURITY.md` that operators are responsible for not pasting secrets into chat

---

## MEDIUM

### M-1 — `audit/route.ts` offset is applied in JS after `LIMIT` returns
**File:** `dashboard/src/app/api/audit/route.ts:32-46`

`listAudit` applies `LIMIT $N` server-side, then the route does `rows.slice(offset)`. For `limit=100, offset=200`, this returns zero rows even if matching rows exist. The "total" field also reflects the post-slice length, which is wrong for paginated UIs.

**Fix:** Push `OFFSET $i` into `listAudit`, return `{ rows, limit, offset, hasMore }`. Don't claim a "total" without a separate `SELECT COUNT(*)`.

### M-2 — `audit/route.ts` swallows error messages into status code via substring match
**File:** `dashboard/src/app/api/audit/route.ts:49`

`const status = msg.includes("Invalid") ? 400 : 500` — this also leaks the raw `err.message` to the client (line 50). Internal `pg` errors will surface their full text. Same anti-pattern in `projects/route.ts:75, 116, 145` and `projects/[slug]/routes/route.ts:91, 122`.

**Fix:** Tag thrown errors with explicit `code` properties or use a discriminated `Result` type; never use substring matching for HTTP status; never return raw `err.message` to clients.

### M-3 — Circuit breaker "half-open" leaks one probe per request, not one global probe
**File:** `dashboard/src/lib/openclaw/client.ts:133-140`

`breakerIsOpen` returns `false` once `now - openedAt >= BREAKER_OPEN_MS` — but it doesn't set `state` to half-open or atomically reserve the probe. Concurrent requests all see `false` and fire in parallel against a known-bad backend. Consumer's `consumer.js:150-165` correctly uses a `probeInFlight` flag; the dashboard client doesn't.

**Fix:** Mirror the consumer's `probeInFlight` pattern. Or short-cut: set `openedAt = now` after letting the probe through, so the second-arriving request still sees `open`.

### M-4 — `provider-resolver.discoverModels` accepts response without a `data` array shape validation
**File:** `dashboard/src/lib/ai/provider-resolver.ts:102-105`

`(await res.json()) as { data?: { id: string }[] }` — cast without zod. If 9Router returns malformed JSON, the filter still runs against `body.data` truthy check. A response of `{data: "stringnotarray"}` would be `Array.isArray(false)` and return `[]`. Safe but silent. Plan emphasizes zod validation at every boundary; this one is missing.

**Fix:** Wrap with `z.object({ data: z.array(z.object({ id: z.string() })) })`.

### M-5 — `openclaw/client.ts` retry on 4xx with `noRetry` flag but no jitter on backoff
**File:** `dashboard/src/lib/openclaw/client.ts:266-268`

`RETRY_DELAYS_MS = [250, 1_000, 2_500]` is deterministic. Thundering herd risk on outage recovery is low at this scale (one dashboard instance) but add ±20% jitter for cleanliness.

### M-6 — `consumer.js` validates `cortex.factory.workflow` schema against both `data` and `blocks` (line 345 + 355) using the same schema name
**File:** `stacks/cortex-consumer/consumer.js:345, 355`

Two `validatePayload("cortex.factory.workflow", ...)` calls with different inputs. The first validates the event envelope; the second validates `blocks` against the same schema. Either the schema is loose enough to accept both shapes (which weakens validation), or the second call always fails silently (validation returns false but execution continues — line 80-84 logs to stderr and returns false, not throws). Either way it's wrong.

**Fix:** Separate schema `templates/nats/schemas/messages.blocks.json` referenced by §4f canonical block schema. Use it for `validatePayload("messages.blocks", blocks)`.

### M-7 — `consumer.js` heartbeat publish does not use JetStream `publish` — race with `nc.drain()` on shutdown
**File:** `stacks/cortex-consumer/consumer.js:305-308, 530-541`

`publish` uses core NATS `nc.publish` (line 307). On SIGTERM, `nc.drain()` is called inside `shutdown` (line 608), but `clearInterval(heartbeat)` runs at line 678 only after the poll loop returns — which only returns when `shuttingDown = true`. There is a window where the heartbeat timer fires *after* drain begins. `nc.publish` on a draining connection rejects. The fire-and-forget catch at line 538 swallows it, so functionally OK, but the heartbeat may not flush its final beat through JetStream.

**Fix:** Move `clearInterval(heartbeat)` into `shutdown` before `nc.drain()`; publish a final heartbeat with `js.publish(...)` and await.

### M-8 — `consumer.js` `redeliveryCount` field name mismatch
**File:** `stacks/cortex-consumer/consumer.js:559, 576, 581`

`m.info?.redeliveryCount ?? 0` — the `nats.js` v2.x JsMsg API uses `m.info.redeliveryCount` only on `JsMsg` (JetStream). Some versions expose `m.info.deliveryCount`. Worth verifying against the installed `nats` package; if the field is misnamed, `deliveryCount` is always 0 → every retryable error goes to DLQ on second attempt, not fifth.

**Fix:** Read `nats` package version, confirm against `JsMsg.info.redeliveryCount` field in node_modules; add a debug log of `m.info` on first message to verify field presence in production smoke.

### M-9 — `service_restart` policy says `class: "destructive"` (policy.json:130) but `service_restart` tool in `tools.ts` doesn't enforce destructive-tier requirements
**File:** `dashboard/src/lib/ai/tools.ts:406-424`

`policy.json` declares `service_restart` as destructive with cooldown 300s and `default_max_per_hour: 1` at the *class* level (line 19). The `ensureApproval` flow handles class lookup → confirmation token → cooldown. But the `max_per_hour` policy entry is **not consulted anywhere** in tools.ts. Per-tool max_per_hour is silently unenforced.

**Fix:** Add a per-tool sliding-window counter in addition to the cooldown gate. Or remove the unenforced policy field and document "cooldown_seconds is the only enforcement".

### M-10 — `004_tailscale_urls.sql` references services that no longer ship (`openviking-ui`, `hindsight`, `hindsight-ui`, `agentgateway-mcp`)
**File:** `dashboard/migrations/004_tailscale_urls.sql:29-37`

The function `cortex_set_service_urls` issues `UPDATE` for slugs that are no longer in `002_seed.sql`. These updates target zero rows — harmless but misleading. Hindsight in particular is explicitly retired per plan §5c.

**Fix:** Remove `openviking-ui`, `hindsight`, `hindsight-ui`, `agentgateway-mcp` UPDATE lines. Also `dashboard` slug at line 26 — seed uses `cortex-dashboard`, not `dashboard`. That UPDATE never matches.

### M-11 — `chat_sessions` PRIMARY KEY is `user_id` but FK to `admin_users(id)` is missing
**File:** `dashboard/migrations/001_schema.sql:217-218`

No `REFERENCES admin_users(id) ON DELETE CASCADE`. Deleting an admin user leaves an orphan chat session row, and `messages` jsonb may contain that user's data persisting after delete.

**Fix:** `user_id INTEGER PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE`.

---

## LOW / Info

### L-1 — `vps-reader.parseEnvFile` accepts unterminated quoted values with "best effort" return
**File:** `dashboard/src/lib/secrets/vps-reader.ts:121-122`

`if (end < 0) return s.slice(1)` — silently strips the unmatched quote. Should throw `EENVPARSE` so the writer doesn't round-trip a malformed file into a different shape.

### L-2 — `confirmation-token.ts` returns `'unknown'` reason on consumed-store IO failure
**File:** `dashboard/src/lib/ai/confirmation-token.ts:209, 235`

If the backing store (in-mem now, JetStream KV later) throws, callers see `reason: 'unknown'`. They can't distinguish "store is down" from "client is wrong". Add structured logging at the failure site (consumer-side error log) before returning unknown.

### L-3 — `openclaw/client.ts` `OpenClawProtocolError` thrown inside retry loop short-circuits properly but is **not** counted as a breaker failure
**File:** `dashboard/src/lib/openclaw/client.ts:259`

Schema-mismatch responses are protocol errors that should still indicate the backend is misbehaving. Today they bypass `breakerOnFailure()`. If upstream OpenClaw ships a regressed schema, the breaker stays closed and every request hits the same failure path.

**Fix:** Call `breakerOnFailure()` before re-throwing the protocol error.

### L-4 — `confirmation-token` default test secret string visible in source
**File:** `dashboard/src/lib/ai/confirmation-token.ts:22`

`'test-only-insecure-secret-do-not-use'` — fine for tests, but if `NODE_ENV` is accidentally set to `'test'` in production (Docker layer leak), this becomes the live secret. Add: assert `process.env.NODE_ENV === 'test'` AND `process.env.JEST_WORKER_ID || process.env.VITEST` before falling back.

### L-5 — `audit/route.ts` accepts free-form `from`/`to` strings into `new Date(...)`
**File:** `dashboard/src/app/api/audit/route.ts:38-39`

`new Date(garbage)` → `Invalid Date` → SQL receives NaN-ish input. `pg` rejects, route returns 500. Validate as ISO-8601 with zod before constructing Date.

### L-6 — `admin/users/route.ts` `audit("admin.user.create", _, username)` uses raw username as `args_hash`
**File:** `dashboard/src/app/api/admin/users/route.ts:58, 102, 132`

`args_hash` field stores a username verbatim, not a hash. Field is documented as a hash and used for cross-call replay protection in `tools.ts`. Username is fine as audit context but should go in `decision_reason` or a separate `target` column; `args_hash` should be `sha256(JSON.stringify({username}))`.

### L-7 — `consumer.js` `validatePayload` returns true on missing schema or missing ajv
**File:** `stacks/cortex-consumer/consumer.js:76-78`

Soft-fails open. Acceptable for v1 startup but a missing schema file in production should be fatal, not silently accepted. Add `if (process.env.STRICT_VALIDATION === '1') throw`.

### L-8 — `consumer.js` `pollConsumer` retry loop has no backoff on fetch errors
**File:** `stacks/cortex-consumer/consumer.js:617-628`

Tight loop calling `consumer.fetch` after error. Combined with NATS disconnect, this can pin a CPU. Add `await sleep(1000)` in the catch.

### L-9 — `tools.ts` `vps_status` is declared `privileged` in `policy.json` (line 118) but **has no destructive side effect**, plan §4a places it under `safe`
**File:** `dashboard/src/lib/ai/tools-data/policy.json:118`

Reading service status is a read. Marking it privileged forces confirmation-token round-trips for trivially safe ops. Plan §4e: "safe — read-only. No approval." vps_status meets that. Demote to `safe`.

### L-10 — `openclaw/client.ts` retry counter is checked before breaker open check inside loop
**File:** `dashboard/src/lib/openclaw/client.ts:265`

After `breakerOnFailure()`, the very next line `if (breakerIsOpen()) throw new CircuitOpenError()` — fine. But the breaker check at top of function (line 238) only runs once. If breaker trips mid-retry, the loop correctly aborts. OK as written — flagging only for awareness during the security review.

---

## What passed (green-light)

- **Path allow-list** (`secrets/allowlist.ts`) is thorough: NUL-byte rejection, parent-traversal block (pre- and post-normalize), symlink resolution via `realpathSync` with existing-ancestor fallback, macOS `/private/etc` accommodation, systemd-override-only-`.d/` enforcement, lazy openclaw.json resolution. Test-override is properly NODE_ENV-gated. ✅
- **`vps-writer.applyUpdates` round-trips comments, blank lines, and the `export` prefix.** Quoting/escaping in `serializeValue` correctly handles whitespace, `#`, quotes, backslashes. ✅
- **Atomic write via `.tmp` + `rename(2)`** is the right shape. Lock file with stale-detection (`LOCK_STALE_MS = 30s`) is sensible. ✅
- **HMAC token**: timing-safe compare via `timingSafeEqual` after length check, pipe-guard against canonical-message injection, single-use enforcement, TTL default 5min, base64url payload. The construction is correct; only the *inputs* are wrong (see CR-1/CR-2). ✅ on crypto, ❌ on identity binding.
- **OpenClaw client**: 10s AbortController timeout, zod-validated responses on every method, exponential backoff with bounded retries, `noRetry` flag on 4xx, Bearer header from env. ✅
- **provider-resolver**: env-only, no DB lookups, 60s `discoverModels` cache, cache keyed on `(baseUrl, apiKey)` so credential rotation invalidates. ✅
- **Schema (001_schema.sql)**: no ALTER TABLE, all tables defined inline, CHECK constraints on every enum-style column, sensible indexes (partial index on unread alerts, descending ts indexes on audit), `BIGSERIAL` for high-volume audit table. ✅
- **Seed (002_seed.sql)**: empty projects, empty messaging_routes, no personal-project names, idempotent ON CONFLICT clauses on every INSERT. ✅
- **cortex-consumer**: JetStream durable + explicit ack, max_deliver=5, exponential backoff in nanos, DLQ on attempt 5, replay-nonce KV with TTL 10min, JCS canonical JSON for HMAC, separate HMAC for inbound envelope and approval payload, stalled-approval timeout with alert publish, graceful SIGTERM with 10s deadline, prometheus metrics exposition. ✅
- **Cross-cutting sweeps** all clean (personal projects, banned SDKs, version pins, ALTER TABLE). ✅

---

## Suggested fix-order for orchestrator

1. CR-1 + CR-2 together (single PR: rework canonicalMessage + verifier inputs in both endpoints + tools.ts).
2. H-3 grants migration (single line at end of 001_schema; verify in deploy.sh).
3. H-1 admin role gate (add column + first-user-becomes-admin + gate routes).
4. H-2 reveal-mode confirmation token (mirror POST flow).
5. H-4 writer hash-from-buffer + O_CREAT|O_EXCL on tmp.
6. H-6 chat_sessions retention + FK.
7. Batch MEDIUMs + LOWs as cleanup PR.

---

_Reviewer: Claude Opus 4.7_
_Mode: report-only_
