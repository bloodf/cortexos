-- Migration 005: Create the dashboard_command_audit table.
--
-- Background (M0-A audit finding F-2):
--   The application code in `lib/db/dashboard-command-audit.ts:41-83` and
--   `lib/db/dashboard-command-audit.ts:90-103` runs INSERTs and UPDATEs
--   against `dashboard_command_audit`, and the root-helper flow in
--   `lib/root-helper/executor.ts:46-124` calls `createDashboardCommandAudit`
--   and `finishDashboardCommandAudit` for every privileged host command.
--   The four migration files (001_schema.sql, 002_seed.sql,
--   003_incus_instances.sql, 004_reconcile_health.sql) do NOT define the
--   table. 002_seed.sql:253 inserts a squashed-applied marker
--   `('018_dashboard_command_audit')` into the `migrations` table, which
--   makes the runner treat the table as if it were created by an earlier
--   migration that was folded into 002. The actual DDL was lost in the
--   squash. The root-helper command flow fails on a fresh DB with
--   `relation "dashboard_command_audit" does not exist`.
--
-- Fix:
--   Author the missing DDL here, in a new migration file (005) whose
--   filename does NOT collide with the squashed `018_dashboard_command_audit`
--   marker in 002_seed.sql:253. The runner keys on the filename minus
--   `.sql`, so `005_dashboard_command_audit` is a different migration
--   name from `018_dashboard_command_audit` and the new file WILL run
--   on both fresh DBs and existing DBs that already ran 002.
--
-- Lifecycle (two-phase write, NOT append-only):
--   INSERT row with status='created' before dispatching the request to the
--   root helper (see lib/db/dashboard-command-audit.ts:37-83). After the
--   helper returns, UPDATE fills in started_at, finished_at, stdout/stderr
--   sha256 + byte counts, exit_code, signal, status, error, journald_cursor,
--   and merges metadata. There is no strict append-only requirement; the
--   agent_gateway_audit table is the true append-only audit log.
--
-- Idempotency:
--   `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`. Safe to
--   re-apply against an existing DB (no-op).
--
-- No self-record:
--   The migration runner (src/lib/db/migrate.ts, scripts/migrate.js)
--   records the filename itself after executing. We do NOT add an
--   `INSERT INTO migrations (name) VALUES ('005_dashboard_command_audit')`
--   to avoid a UNIQUE collision. (Same convention as 004_reconcile_health.sql:44-47.)

CREATE TABLE IF NOT EXISTS dashboard_command_audit (
  -- Surrogate primary key. request_id is the natural identifier but we
  -- also need a stable monotonic id for admin pagination.
  id                       BIGSERIAL    PRIMARY KEY,

  -- Request identity
  request_id               TEXT         NOT NULL,
  requested_by             TEXT         NOT NULL DEFAULT 'trusted-dashboard',
  source_ip                INET         NULL,
  source_user_agent        TEXT         NULL,
  dashboard_session_id     TEXT         NULL,

  -- Command spec (what was requested)
  command                  TEXT         NOT NULL,
  argv                     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  cwd                      TEXT         NULL,
  env_allowlist            JSONB        NOT NULL DEFAULT '{"names": []}'::jsonb,
  stdin_sha256             TEXT         NULL,
  timeout_ms               INTEGER      NULL,
  approved_policy          TEXT         NOT NULL DEFAULT 'trusted-lan-tailnet',
  mutation_class           TEXT         NOT NULL DEFAULT 'unknown',
  target_scope             TEXT         NOT NULL DEFAULT 'host',
  dry_run                  BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Lifecycle (filled by finishDashboardCommandAudit)
  status                   TEXT         NOT NULL DEFAULT 'created',
  started_at               TIMESTAMPTZ  NULL,
  finished_at              TIMESTAMPTZ  NULL,
  stdout_sha256            TEXT         NULL,
  stderr_sha256            TEXT         NULL,
  stdout_bytes             INTEGER      NOT NULL DEFAULT 0,
  stderr_bytes             INTEGER      NOT NULL DEFAULT 0,
  exit_code                INTEGER      NULL,
  signal                   TEXT         NULL,
  error                    TEXT         NULL,
  journald_cursor          TEXT         NULL,

  -- Free-form bag (caller-defined; merged via `||` on UPDATE)
  metadata                 JSONB        NOT NULL DEFAULT '{}'::jsonb,

  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- request_id is the natural lookup key for the UPDATE ... WHERE request_id = $1
-- (lib/db/dashboard-command-audit.ts:103) and the socket protocol's request_id
-- echo. The root-helper Unix-socket protocol guarantees a single attempt per
-- request_id per call, so UNIQUE is safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_command_audit_request_id
  ON dashboard_command_audit (request_id);

-- Recent activity feed (admin viewer pagination).
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_created_at
  ON dashboard_command_audit (created_at DESC);

-- Per-operator queries (audit the actions of a specific dashboard user).
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_requester_created
  ON dashboard_command_audit (requested_by, created_at DESC);

-- Status filter (e.g. "show me everything still in 'created' state",
-- or "all 'error' rows in the last 24h").
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_status_created
  ON dashboard_command_audit (status, created_at DESC);

-- Command-name filter (e.g. "all docker invocations today").
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_command_created
  ON dashboard_command_audit (command, created_at DESC);

-- Auto-touch updated_at on UPDATE. Keeps the row honest without forcing
-- every caller to set it.
CREATE OR REPLACE FUNCTION dashboard_command_audit_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dashboard_command_audit_touch_updated_at
  ON dashboard_command_audit;

CREATE TRIGGER trg_dashboard_command_audit_touch_updated_at
  BEFORE UPDATE ON dashboard_command_audit
  FOR EACH ROW
  EXECUTE FUNCTION dashboard_command_audit_touch_updated_at();
