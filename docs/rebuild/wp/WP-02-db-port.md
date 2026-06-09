# WP-02 — DB port
- **Wave:** 0   **Depends-on:** none   **Parallel-safe-with:** WP-00, WP-03, WP-04
- **Owns (edit only these):** `packages/dashboard-next/src/server/db/**`, `packages/dashboard-next/migrations/**`, `packages/dashboard-next/scripts/migrate-cli.js`
- **Do NOT touch:** any `packages/dashboard/**` (legacy — copy FROM it, never edit it), `vite.config.ts`, `src/server/auth/**`, `src/server/define-api-route.ts`, route files.

## Objective
Port the Drizzle DB layer (client, schema, all repos) and the SQL migrations verbatim from legacy into `packages/dashboard-next`, plus a self-contained `migrate-cli.js`. Done = repos compile under TS strict, a smoke query against the live `cortex_dashboard` DB returns rows, and `migrate-cli.js` is idempotent (re-running applies nothing new).

## Read first
- `packages/dashboard/src/lib/server/db/client.ts` — `getDb()`, `db` Proxy, `DbClient` (cross-driver `PgDatabase<PgQueryResultHKT, typeof schema>`), `NodePgDbClient`, env reading (`DB_PASSWORD` required; `DB_HOST/DB_PORT/DB_NAME/DB_USER` optional). Pool tuning: `max:20, idleTimeoutMillis:30_000, connectionTimeoutMillis:5_000`.
- `packages/dashboard/src/lib/server/db/schema.ts` — all Drizzle table defs. Exported tables (port ALL): `migrationsTable, services, badges, serviceBadges, alerts, agentGatewayAudit, projects, messagingRoutes, pamUsers, adminSessions, serviceHealthLog, alertRules, alertHistory, actionLog, config, dashboardLayouts, chatSessions, incusInstances, auditLog, pendingApprovals, dashboardCommandAudit, mailGuardianReviews, mailGuardianActions, mailGuardianProcessed, mailGuardianRules, mailGuardianAccounts`.
- `packages/dashboard/src/lib/server/db/repos/*.ts` — repos to port: `services.ts, audit.ts, audit_events.ts, mail_guardian.ts, alerts.ts, pending_approvals.ts, dashboard_command_audit.ts, users.ts`. Repos take `db: DbClient` as first arg (driver-agnostic).
- `packages/dashboard/src/lib/server/db/migrate.ts` — `runSqlMigrations`, `getLanIp`, `replaceVpsLanIp` (`<VPS_LAN_IP>` substitution), `defaultMigrationsDir`, `pgExecutor`. Also `client.pglite.ts` (test driver) and `db/test-utils.ts`.
- `packages/dashboard/migrations/*.sql` — port verbatim, same order: `001_schema.sql, 002_session_columns_for_auth.sql, 003_incus_instances.sql, 004_session_indexes.sql, 006_indexes_for_rbac_audit.sql, 007_grants_dashboard_command_audit.sql, 008_dashboard_command_audit.sql, 009_hermes_webui_boxbox_seed.sql, 010_memory_os_seed.sql, 011_mail_guardian.sql`. (No 005 — intentionally skipped.)
- `packages/dashboard/scripts/migrate-cli.js` — standalone runner: bootstraps `migrations` table, applies unapplied `*.sql` in lexical order, substitutes `<VPS_LAN_IP>`, inserts row with `ON CONFLICT (name) DO NOTHING`. Uses `pg` `Client`, reads from `process.cwd()/migrations`.
- `02-CONVENTIONS.md` §Directory layout (`src/server/db/` = client.ts, schema.ts, repos/*, migrate) and §Coding standards (TS strict, no `any` at boundaries).
- `packages/contracts/src/entities/*` — repos map rows to `@cortexos/contracts` types (`Service`, `Alert`, `IncusInstance`, mail_guardian types, etc.); reuse verbatim, do not redefine.

## Steps
1. Copy `client.ts`, `schema.ts`, `client.pglite.ts`, `migrate.ts`, `session-gc.ts`, `test-utils.ts`, and `index.ts` from legacy `db/` into `src/server/db/`. Copy the whole `repos/` folder (8 repos + `__tests__/`).
2. Rewrite import specifiers: legacy uses SvelteKit `$lib/server/...` aliases; the new app uses relative paths (or the `@/` alias per `tsconfig.json`). Replace `$lib/server/db/...` → relative `./...`, and `$lib/server/...` → the corresponding new `src/server/...` path. Replace any `../entities` imports with `@cortexos/contracts` where the entity types live there (confirm per-file).
3. Confirm `pg`, `drizzle-orm`, `@electric-sql/pglite` (test) are available to the new package. If a dep is missing from `packages/dashboard-next/package.json`, add it (match the legacy version range) — these are inside OWNS only insofar as the package manifest; if adding a dep requires editing `package.json` (a shared file), note it in `STATUS.md` and add ONLY the missing dep lines.
4. Copy all 10 `*.sql` files into `packages/dashboard-next/migrations/` unchanged (preserve filenames + the `INSERT INTO migrations (name) VALUES ('NNN_...') ON CONFLICT DO NOTHING;` tail in each).
5. Copy `migrate-cli.js` into `packages/dashboard-next/scripts/`. It reads `process.cwd()/migrations`, so it must be run from the package dir. Keep the `SAFE_FILENAME_RE`, `<VPS_LAN_IP>` substitution, and idempotent `ON CONFLICT` insert intact.
6. Port the DB `__tests__/` that validate schema columns + repos so the smoke checks have coverage (`db/__tests__/*`, `repos/__tests__/*`). Adjust imports only.

## Acceptance criteria
- [ ] All repos + schema + client compile under TS strict (`pnpm --filter @cortexos/dashboard-next typecheck` or build) with no `any` at boundaries.
- [ ] A smoke query against the live `cortex_dashboard` returns rows (e.g. `getDb()` + `listServices(db, {})`).
- [ ] `scripts/migrate-cli.js` run twice in a row: first applies pending migrations (or "no new migrations"), second prints "(no new migrations)" — idempotent.
- [ ] Table/column shapes match legacy `schema.ts` exactly (no renames).
- [ ] no edits outside OWNS (legacy untouched).

## Verification commands
```bash
pnpm --filter @cortexos/dashboard-next typecheck   # or: build
# Idempotent migrate (run from the package dir; needs DB_PASSWORD in env):
( set -a; . /opt/cortexos/.secrets/dashboard.env; set +a; \
  cd packages/dashboard-next && node scripts/migrate-cli.js && node scripts/migrate-cli.js )
# Smoke query (psql sanity against live DB):
psql "host=127.0.0.1 dbname=cortex_dashboard user=dashboard" -c 'select count(*) from services;'
# Repo unit tests (pglite):
pnpm --filter @cortexos/dashboard-next test -- db
```

## Notes / gotchas
- `client.ts`'s `db` is a lazy Proxy — it does NOT touch `DB_PASSWORD` at import time. Preserve that; build steps import this file without DB env.
- Migrations are applied by lexical filename order; `migrate-cli.js` is the source of truth, not the Drizzle `migrate.ts` (which is the in-process variant for tests). Keep both.
- `<VPS_LAN_IP>` placeholder in seed SQL is substituted at apply-time from the host's primary NIC. Do not hardcode an IP.
- The DB is shared with the legacy app and must stay unchanged — do NOT add or alter migrations in this WP; only port the existing 10.
- `DbClient` is intentionally the widened `PgDatabase<PgQueryResultHKT, ...>` type so repos work against both `node-postgres` and pglite. Keep repo signatures `(db: DbClient, ...)`.
