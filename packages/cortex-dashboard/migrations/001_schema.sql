-- Schema: CortexOS Dashboard v1.0 (no-vault, direct shape)
-- Dashboard never stores secrets. Live env state read from VPS env files via services.env_source.

CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
);

-- Core service registry
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  kind VARCHAR(16) NOT NULL DEFAULT 'service'
    CHECK (kind IN ('app','service','docker','process')),
  category VARCHAR(64) NOT NULL,
  description TEXT DEFAULT NULL,
  health_url VARCHAR(512) NOT NULL DEFAULT '#',
  health_type VARCHAR(16) NOT NULL DEFAULT 'http',
  open_url VARCHAR(512) NOT NULL DEFAULT '#',
  env_source TEXT DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'unknown',
  last_check_at TIMESTAMP DEFAULT NULL,
  response_ms INTEGER DEFAULT NULL,
  uptime_24h NUMERIC(5,2) DEFAULT NULL,
  -- Preserved UI fields
  icon_type VARCHAR(32) DEFAULT 'auto',
  icon_color VARCHAR(7) DEFAULT NULL,
  icon_image TEXT DEFAULT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  has_webui BOOLEAN DEFAULT true,
  show_in_healthcheck BOOLEAN DEFAULT true,
  show_in_webui BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Badge catalog (redesigned: catalog, not per-service)
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  label VARCHAR(64) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#1f2937',
  text_color VARCHAR(7) NOT NULL DEFAULT '#ffffff',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_badges (
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (service_id, badge_id)
);

-- Operational alerts (distinct from rule-based alert_history)
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL
    CHECK (severity IN ('info','warn','error','critical')),
  title VARCHAR(255) NOT NULL,
  body TEXT DEFAULT NULL,
  source VARCHAR(128) DEFAULT NULL,
  acknowledged_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent gateway audit (append-only; revoke UPDATE/DELETE from dashboard app role at deploy time)
CREATE TABLE IF NOT EXISTS agent_gateway_audit (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMP NOT NULL DEFAULT NOW(),
  actor_user_id INTEGER DEFAULT NULL,
  session_id VARCHAR(128) DEFAULT NULL,
  request_id VARCHAR(128) DEFAULT NULL,
  role VARCHAR(128) DEFAULT NULL,
  account VARCHAR(128) DEFAULT NULL,
  tool VARCHAR(255) DEFAULT NULL,
  tool_class VARCHAR(16) NOT NULL
    CHECK (tool_class IN ('safe','privileged','destructive')),
  args_hash TEXT NOT NULL,
  approval_id VARCHAR(128) DEFAULT NULL,
  nonce VARCHAR(128) DEFAULT NULL,
  policy_version INTEGER DEFAULT NULL,
  decision VARCHAR(16) NOT NULL
    CHECK (decision IN ('allow','deny','prompt')),
  decision_reason TEXT DEFAULT NULL,
  before_state_hash TEXT DEFAULT NULL,
  after_state_hash TEXT DEFAULT NULL,
  latency_ms INTEGER DEFAULT NULL,
  result VARCHAR(16) NOT NULL
    CHECK (result IN ('ok','err','timeout','denied'))
);
COMMENT ON TABLE agent_gateway_audit IS
  'Append-only. Dashboard app role must have INSERT,SELECT only; REVOKE UPDATE,DELETE at deploy.';

-- Projects (no tokens; live secrets stay in host-owned env files)
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  repo_url VARCHAR(512) DEFAULT NULL,
  primary_pm_account VARCHAR(128) DEFAULT NULL,
  messaging_mode VARCHAR(16) NOT NULL DEFAULT 'single'
    CHECK (messaging_mode IN ('single','distributed')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messaging routes (no tokens; account_ref points to an operator-managed account)
CREATE TABLE IF NOT EXISTS messaging_routes (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform VARCHAR(16) NOT NULL
    CHECK (platform IN (
      'telegram','slack','discord','whatsapp','signal','sms','email',
      'matrix','mattermost','teams','line','viber','wechat','webhook'
    )),
  account_ref VARCHAR(128) NOT NULL,
  route_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_gates TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin / auth
-- H-1: is_admin gates destructive AI/admin routes. The first user created
-- via /api/auth/setup bootstrap is marked admin. Subsequent users default
-- to non-admin and must be elevated explicitly.
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Health log
CREATE TABLE IF NOT EXISTS service_health_log (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'unknown',
  response_time_ms INTEGER DEFAULT NULL,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- Alert rules / rule-based history
CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  condition VARCHAR(32) NOT NULL CHECK (condition IN ('offline','online','response_time')),
  threshold_ms INTEGER DEFAULT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Action audit (UI-initiated docker/systemd actions)
CREATE TABLE IF NOT EXISTS action_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER DEFAULT NULL,
  username VARCHAR(255) DEFAULT NULL,
  target_type VARCHAR(32) NOT NULL CHECK (target_type IN ('docker','systemd','updates','local-user','mail-guardian')),
  target_name VARCHAR(255) NOT NULL,
  action VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('success','failure')),
  message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Key/value config
CREATE TABLE IF NOT EXISTS config (
  key VARCHAR(128) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dashboard layouts (per user)
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER DEFAULT 1,
  layout JSONB NOT NULL DEFAULT '{"rows":[]}'::jsonb,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat sessions (per-user server-side chat state; redacted tool outputs)
-- H-6: FK + retention TTL + size cap. Orphan-free on user delete.
CREATE TABLE IF NOT EXISTS chat_sessions (
  user_id INTEGER PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  panel_open BOOLEAN NOT NULL DEFAULT false,
  width INTEGER NOT NULL DEFAULT 360,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (length(messages::text) < 1000000)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_kind_status ON services(kind, status);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_badges_badge ON service_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(created_at DESC) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_ts ON agent_gateway_audit(ts DESC);
CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_role_ts ON agent_gateway_audit(role, ts DESC);
CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_actor_ts ON agent_gateway_audit(actor_user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_messaging_routes_project ON messaging_routes(project_id);
CREATE INDEX IF NOT EXISTS idx_messaging_routes_platform ON messaging_routes(platform);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_service_health_log_service_id ON service_health_log(service_id);
CREATE INDEX IF NOT EXISTS idx_service_health_log_checked_at ON service_health_log(checked_at);
CREATE INDEX IF NOT EXISTS idx_alert_rules_service_id ON alert_rules(service_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_service_id ON alert_history(service_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at);
CREATE INDEX IF NOT EXISTS idx_action_log_created_at ON action_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_target ON action_log(target_type, target_name);
CREATE INDEX IF NOT EXISTS idx_action_log_status ON action_log(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_user ON dashboard_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_expires_at ON chat_sessions(expires_at);

-- ============================================================
-- H-3: Append-only enforcement for agent_gateway_audit.
-- The forensic trail must never be mutable from the app role.
-- If a 'dashboard' role exists, revoke UPDATE/DELETE/TRUNCATE
-- and grant only INSERT/SELECT. Wrapped to stay idempotent
-- when the role has not yet been provisioned at fresh-bootstrap.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard') THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON agent_gateway_audit FROM dashboard';
    EXECUTE 'GRANT INSERT, SELECT ON agent_gateway_audit TO dashboard';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Non-fatal: fresh DBs without the role yet still apply schema; the
  -- deploy step provisions the role and re-runs this migration.
  NULL;
END $$;

-- Retention cleanup indexes (was 003_retention)
CREATE INDEX IF NOT EXISTS idx_service_health_log_checked_at_retention ON service_health_log(checked_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at_retention ON alert_history(created_at);

-- Hash-chained audit hypertable (was 008_audit_log)
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGSERIAL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id        UUID NOT NULL,
  event_type      TEXT NOT NULL,
  source          TEXT NOT NULL,
  subject         TEXT,
  actor           TEXT,
  payload_hash    TEXT NOT NULL,
  prev_hash       TEXT NOT NULL,
  chain_hash      TEXT NOT NULL,
  rekor_log_index BIGINT,
  payload         JSONB NOT NULL,
  PRIMARY KEY (occurred_at, id)
);

SELECT create_hypertable('audit_log', 'occurred_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type
  ON audit_log (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_subject
  ON audit_log (subject, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_chain_head
  ON audit_log (occurred_at DESC, id DESC);

-- Pending approvals queue (was 009_pending_approvals)
CREATE TABLE IF NOT EXISTS pending_approvals (
  id              BIGSERIAL PRIMARY KEY,
  run_id          TEXT        NOT NULL,
  signal_name     TEXT        NOT NULL,
  role            TEXT,
  issue_id        TEXT,
  reason          TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  timeout_at      TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  decision        TEXT,
  approver        TEXT,
  CONSTRAINT pending_approvals_decision_chk
    CHECK (decision IS NULL OR decision IN ('approve', 'deny', 'timeout')),
  CONSTRAINT pending_approvals_unique_run_signal
    UNIQUE (run_id, signal_name)
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_open
  ON pending_approvals (requested_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pending_approvals_run_id
  ON pending_approvals (run_id);

-- Dashboard root-helper command audit (was 018_dashboard_command_audit)
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

-- Mail Guardian tables (was 020_mail_guardian + 021_mail_guardian_actions)
CREATE TABLE IF NOT EXISTS mail_guardian_processed (
  id BIGSERIAL PRIMARY KEY,
  account_slug TEXT NOT NULL,
  message_uid BIGINT NOT NULL,
  message_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('trashed','would_trash','pending_review','kept','skipped')),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_slug, message_uid)
);

CREATE TABLE IF NOT EXISTS mail_guardian_reviews (
  id BIGSERIAL PRIMARY KEY,
  account_slug TEXT NOT NULL,
  message_uid BIGINT NOT NULL,
  message_id TEXT,
  from_hash TEXT NOT NULL,
  domain_hash TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  model_verdict TEXT NOT NULL,
  model_confidence NUMERIC(5,4) NOT NULL,
  owner_decision TEXT CHECK (owner_decision IS NULL OR owner_decision IN ('spam','keep','block_sender','allow_sender')),
  approver TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (account_slug, message_uid)
);

CREATE TABLE IF NOT EXISTS mail_guardian_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('allow','block')),
  scope TEXT NOT NULL CHECK (scope IN ('sender','domain')),
  value_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_type, scope, value_hash)
);

CREATE INDEX IF NOT EXISTS idx_mail_guardian_reviews_open
  ON mail_guardian_reviews (requested_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mail_guardian_processed_account
  ON mail_guardian_processed (account_slug, processed_at DESC);

CREATE TABLE IF NOT EXISTS mail_guardian_actions (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES mail_guardian_reviews(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('spam','keep','block_sender','allow_sender')),
  approver TEXT NOT NULL DEFAULT 'dashboard',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_mail_guardian_actions_pending
  ON mail_guardian_actions (requested_at, id)
  WHERE status = 'pending';

INSERT INTO migrations (name) VALUES ('001_schema')
ON CONFLICT (name) DO NOTHING;
