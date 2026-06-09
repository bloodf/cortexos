# WP-15 — API: Mail Guardian

- **Wave:** 1
- **Depends-on:** WP-01, WP-02
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-13, WP-14, WP-16, WP-17, WP-18, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/mail-guardian/`
  - `packages/dashboard-next/src/routes/api/mail-guardian/`
- **Do NOT touch:** `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, any other WP's folder

## Objective

Port all `/api/mail-guardian/*` endpoints from the legacy SvelteKit app. These cover account CRUD (monitored IMAP mailboxes), review list/flag/approve, and batch decision updates. The `mail_guardian_accounts` table stores IMAP credentials with passwords base64-encoded; the API never returns the raw `passwordB64` field — it returns `hasPassword: boolean` instead. The classifier package (`packages/cortex-mail-guardian`) is referenced for future wiring but is not called by these endpoints (they operate on pre-classified reviews already in the DB).

## Read first

- **Legacy repo (primary source):**
  - `packages/dashboard/src/lib/server/db/repos/mail_guardian.ts` — full file:
    - `listMailReviews(db, opts)` — paginated, filters: `accountSlug`, `pendingOnly`
    - `getMailReviewById(db, id)`
    - `listPendingActions(db, limit)`
    - `getMailStats(db)` — 7 counters: total, pending, resolved, approved, flagged, highRisk, actionsPending
    - `updateMailReviewDecision(db, id, decision, approver)` — sets `ownerDecision`, `approver`, `resolvedAt`
    - `createMailGuardianAction(db, input)` — inserts into `mail_guardian_actions`
    - `batchUpdateMailReviewDecisions(db, ids, decision, approver)`
    - `listMailAccounts(db)`, `getMailAccountBySlug(db, slug)`, `createMailAccount(db, input)`, `updateMailAccount(db, slug, input)`, `setMailAccountEnabled(db, slug, enabled)`, `deleteMailAccount(db, slug)`
    - `MailGuardianAccountSafe` type — omits `passwordB64`, adds `hasPassword: boolean`
- **Legacy API handlers:**
  - `packages/dashboard/src/routes/api/mail-guardian/accounts/+server.ts` — GET list + POST create
  - `packages/dashboard/src/routes/api/mail-guardian/accounts/[slug]/+server.ts` — PUT/PATCH/DELETE
  - `packages/dashboard/src/routes/api/mail-guardian/[id]/flag/+server.ts`
  - `packages/dashboard/src/routes/api/mail-guardian/[id]/approve/+server.ts`
  - `packages/dashboard/src/routes/api/mail-guardian/batch/+server.ts`
- **Schema:** `packages/dashboard/src/lib/server/db/schema.ts` — `mailGuardianReviews`, `mailGuardianActions`, `mailGuardianAccounts` tables (ported to WP-02's `src/server/db/schema.ts`)
- **Classifier package location:** `packages/cortex-mail-guardian/src/` (read-only reference; not called by these HTTP endpoints)
- **Contract section:** `01-API-CONTRACT.md §Mail-Guardian (WP-15)`

## Steps

1. **Create `src/server/mail-guardian/index.ts`** — re-exports the repo functions for use by routes:
   ```ts
   export * from '../db/repos/mail_guardian';
   ```
   (WP-02 ports the repo to `src/server/db/repos/mail_guardian.ts`.)
   If the repo path differs, adjust accordingly. The mail-guardian server module may add future classifier wiring here; keep the file minimal for now.

2. **Declare accounts routes:**

   `src/routes/api/mail-guardian/accounts/index.ts`:
   ```
   GET  /api/mail-guardian/accounts — auth: admin → {accounts: MailGuardianAccountSafe[]}
        calls listMailAccounts(db)
   POST /api/mail-guardian/accounts — auth: admin, input: MailAccountCreateSchema
        → calls createMailAccount(db, input), returns MailGuardianAccountSafe (201)
   ```
   Input schema for POST:
   ```ts
   z.object({
     slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
     address: z.string().email(),
     host: z.string().min(1).max(253),
     port: z.number().int().min(1).max(65535),
     secure: z.boolean(),
     username: z.string().min(1).max(254),
     password: z.string().min(1).max(1024),   // required for create
     inbox: z.string().default('INBOX'),
     trashMailbox: z.string().nullable().optional(),
     reviewMailbox: z.string().default('INBOX.Review'),
     enabled: z.boolean().default(true),
   })
   ```

   `src/routes/api/mail-guardian/accounts/$slug/index.ts`:
   ```
   PUT   /api/mail-guardian/accounts/:slug — auth: admin, input: MailAccountUpdateSchema
         → calls updateMailAccount(db, slug, input), returns MailGuardianAccountSafe
   PATCH /api/mail-guardian/accounts/:slug — auth: admin, input: partial patch
         → calls setMailAccountEnabled(db, slug, enabled) for enable/disable toggle
            or updateMailAccount for full patch
   DELETE /api/mail-guardian/accounts/:slug — auth: admin → calls deleteMailAccount(db, slug), returns {ok:true}
   ```
   `password` is optional in the update schema (omit → keep existing `passwordB64`).

3. **Declare reviews route:**

   `src/routes/api/mail-guardian/reviews/index.ts`:
   ```
   GET /api/mail-guardian/reviews — auth: any, query: {account?, status?, page?}
       → calls listMailReviews(db, { accountSlug: account, pendingOnly: status==='pending', page })
       returns {reviews: MailGuardianReview[], total, page, pageSize}
   ```

4. **Declare flag route:**

   `src/routes/api/mail-guardian/$id/flag/index.ts`:
   ```
   POST /api/mail-guardian/:id/flag — auth: admin
        → calls updateMailReviewDecision(db, id, 'spam', user.username)
          and createMailGuardianAction(db, { reviewId: id, decision: 'spam', approver: user.username })
        returns {review: MailGuardianReview}
   ```

5. **Declare approve route:**

   `src/routes/api/mail-guardian/$id/approve/index.ts`:
   ```
   POST /api/mail-guardian/:id/approve — auth: admin
        → calls updateMailReviewDecision(db, id, 'keep', user.username)
          and createMailGuardianAction(db, { reviewId: id, decision: 'keep', approver: user.username })
        returns {review: MailGuardianReview}
   ```

6. **Declare batch route:**

   `src/routes/api/mail-guardian/batch/index.ts`:
   ```
   POST /api/mail-guardian/batch — auth: admin
   input: { ids: number[], decision: 'keep' | 'spam' }
   → calls batchUpdateMailReviewDecisions(db, ids, decision, user.username)
   returns {updated: number}
   ```
   Input schema:
   ```ts
   z.object({
     ids: z.array(z.number().int().positive()).min(1).max(500),
     decision: z.enum(['keep', 'spam']),
   })
   ```

7. **Auth / rate-limit / audit** — all routes use `defineApiRoute`:
   - Account CRUD: `auth: 'admin'`, `surface: 'mail-guardian'`
   - Reviews GET: `auth: 'any'`
   - Flag/approve/batch: `auth: 'admin'`, `surface: 'mail-guardian'`
   - No rate-limit overrides needed (inherit defaults)

8. **404 handling** — `getMailReviewById` / `getMailAccountBySlug` returning null → throw `notFoundError`.

## Acceptance criteria

- [ ] `GET /api/mail-guardian/accounts` returns the 3 seeded accounts (from `mail_guardian_accounts` DB rows) as `MailGuardianAccountSafe[]` — no `passwordB64` field present, `hasPassword: true`
- [ ] `POST /api/mail-guardian/accounts` creates a new account; rejects non-admin with 403; stores password as base64 (`Buffer.from(password,'utf8').toString('base64')`)
- [ ] `DELETE /api/mail-guardian/accounts/:slug` removes the account; 404 if not found
- [ ] `GET /api/mail-guardian/reviews` returns paginated review rows; `?status=pending` filters to unresolved
- [ ] `POST /api/mail-guardian/:id/flag` sets `ownerDecision='spam'` and creates a `mail_guardian_actions` row
- [ ] `POST /api/mail-guardian/:id/approve` sets `ownerDecision='keep'`
- [ ] `POST /api/mail-guardian/batch` with `ids=[1,2]` and `decision='spam'` updates both rows, returns `{updated:2}`
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# Accounts (3 seeded rows expected)
curl -s http://localhost:3080/api/mail-guardian/accounts \
  -b "cortexos_session=$SESSION" | jq '{count:.accounts|length, has_password_b64: ([.accounts[].passwordB64] | any(. != null))}'
# expect count:3, has_password_b64:false

# Reviews
curl -s "http://localhost:3080/api/mail-guardian/reviews?page=1" \
  -b "cortexos_session=$SESSION" | jq '{total, page}'

# Flag review 1 as spam
curl -s -X POST http://localhost:3080/api/mail-guardian/1/flag \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" | jq '.review.ownerDecision'
# expect "spam"

# Batch
curl -s -X POST http://localhost:3080/api/mail-guardian/batch \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"ids":[1,2],"decision":"keep"}' | jq .updated

# DB check
psql $DATABASE_URL -c "SELECT slug, address, has_password_b64 FROM mail_guardian_accounts LIMIT 3;"
```

## Notes / gotchas

- **Password never returned** — `listMailAccounts` / `createMailAccount` / `updateMailAccount` all call the `toSafe()` helper in the repo which strips `passwordB64` and replaces it with `hasPassword: passwordB64.length > 0`. The routes must not add `passwordB64` back. Never log passwords.
- **Password encoding** — `Buffer.from(password, 'utf8').toString('base64')`. This matches the legacy repo exactly. The mail-guardian daemon reads these rows and decodes with `Buffer.from(passwordB64, 'base64').toString('utf8')`.
- **`batchUpdateMailReviewDecisions` loop** — the legacy repo issues one UPDATE per id in a loop because `drizzle-orm`'s `inArray` was not available at the time. Port this verbatim; do not refactor to `inArray` (schema compatibility).
- **Classifier package** — `packages/cortex-mail-guardian/src/` contains the spam classifier used by the mail-guardian daemon (offline). These HTTP endpoints do NOT call the classifier — they only read/write the review rows that the daemon already classified. Do not import from `packages/cortex-mail-guardian` in this WP.
- **Seeded accounts** — migration `010_memory_os_seed.sql` seeds the `mail_guardian_accounts` table with 3 representative accounts. The acceptance test expects exactly 3 rows from `listMailAccounts`.
- **`PATCH` vs `PUT`** — the contract lists both; implement `PUT` as a full update (all fields required except password) and `PATCH` as a partial update. For simplicity, route both to `updateMailAccount` with the input partially applied.
- **`id` parameter type** — review ids are integers. Parse with `parseInt(params.id, 10)` and throw `validationError` if `isNaN`.
