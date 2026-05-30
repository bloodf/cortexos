-- Dashboard root-helper command audit.

CREATE TABLE IF NOT EXISTS dashboard_command_audit (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  requested_by TEXT NOT NULL DEFAULT 'trusted-dashboard',
  source_ip INET,
  source_user_agent TEXT,
  dashboard_session_id TEXT,
  command TEXT NOT NULL,
  argv JSONB NOT NULL DEFAULT '[]'::JSONB,
  cwd TEXT,
  env_allowlist JSONB NOT NULL DEFAULT '{}'::JSONB,
  stdin_sha256 TEXT,
  stdout_sha256 TEXT,
  stderr_sha256 TEXT,
  stdout_bytes BIGINT NOT NULL DEFAULT 0,
  stderr_bytes BIGINT NOT NULL DEFAULT 0,
  exit_code INTEGER,
  signal TEXT,
  timeout_ms INTEGER,
  approved_policy TEXT NOT NULL DEFAULT 'trusted-lan-tailnet',
  mutation_class TEXT NOT NULL DEFAULT 'unknown',
  target_scope TEXT NOT NULL DEFAULT 'host',
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'created',
  error TEXT,
  journald_cursor TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS dashboard_command_audit_requested_at_idx
  ON dashboard_command_audit (requested_at DESC);

CREATE INDEX IF NOT EXISTS dashboard_command_audit_request_id_idx
  ON dashboard_command_audit (request_id);

CREATE INDEX IF NOT EXISTS dashboard_command_audit_status_idx
  ON dashboard_command_audit (status);
