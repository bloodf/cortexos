-- Migration 008: Create dashboard_command_audit table.
--
-- Background (M1.5 follow-up):
--   The Drizzle schema (packages/dashboard/src/lib/server/db/schema.ts)
--   defines `dashboard_command_audit` but no migration created the table.
--   This is the root cause of failures in alerts.test.ts, audit.test.ts,
--   services.test.ts, and migrate.test.ts.
--
-- Lifecycle (per schema doc):
--   1. INSERT row with status='created' before dispatching the root-helper.
--   2. UPDATE fills in completion fields (exit_code, status, etc.) after
--      the root helper returns.
--
-- Grants are issued in 007_grants_dashboard_command_audit.sql.
-- This migration only creates the table + indexes + constraints.

CREATE TABLE IF NOT EXISTS dashboard_command_audit (
    id                    BIGSERIAL PRIMARY KEY,
    -- Request identity
    request_id            TEXT NOT NULL UNIQUE,
    requested_by          TEXT NOT NULL DEFAULT 'trusted-dashboard',
    source_ip             TEXT,  -- inet in production, text in pglite (customType bridge)
    source_user_agent     TEXT,
    dashboard_session_id  TEXT,
    -- Command spec
    command               TEXT NOT NULL,
    argv                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    cwd                   TEXT,
    env_allowlist         JSONB NOT NULL DEFAULT '{"names": []}'::jsonb,
    stdin_sha256          TEXT,
    timeout_ms            INTEGER,
    approved_policy       TEXT NOT NULL DEFAULT 'trusted-lan-tailnet',
    mutation_class        TEXT NOT NULL DEFAULT 'unknown',
    target_scope          TEXT NOT NULL DEFAULT 'host',
    dry_run               BOOLEAN NOT NULL DEFAULT FALSE,
    -- Lifecycle
    status                TEXT NOT NULL DEFAULT 'created',
    started_at            TIMESTAMPTZ,
    finished_at           TIMESTAMPTZ,
    stdout_sha256         TEXT,
    stderr_sha256         TEXT,
    stdout_bytes          INTEGER NOT NULL DEFAULT 0,
    stderr_bytes          INTEGER NOT NULL DEFAULT 0,
    exit_code             INTEGER,
    signal                TEXT,
    error                 TEXT,
    journald_cursor       TEXT,
    -- Free-form
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Constraints
    CONSTRAINT dashboard_command_audit_status_check
        CHECK (status IN ('created', 'dispatched', 'running', 'succeeded', 'failed', 'timed_out', 'cancelled'))
);

-- Indexes (named to match the Drizzle schema declaration).
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_command_audit_request_id
    ON dashboard_command_audit (request_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_created_at
    ON dashboard_command_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_requester_created
    ON dashboard_command_audit (requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_status_created
    ON dashboard_command_audit (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_command_created
    ON dashboard_command_audit (command, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_command_audit_session
    ON dashboard_command_audit (dashboard_session_id, created_at DESC);
