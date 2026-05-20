-- 021_paperclip_service_readiness.sql
-- Idempotent repair for live Paperclip/dashboard readiness on hosts where
-- earlier migrations were marked applied before their tables or probes existed.

CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGSERIAL PRIMARY KEY,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id        UUID,
  event_type      TEXT NOT NULL,
  source          TEXT NOT NULL,
  subject         TEXT,
  actor           TEXT,
  payload_hash    TEXT NOT NULL,
  prev_hash       TEXT NOT NULL,
  chain_hash      TEXT NOT NULL,
  rekor_log_index BIGINT,
  payload         JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type
  ON audit_log (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_subject
  ON audit_log (subject, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_chain_head
  ON audit_log (occurred_at DESC, id DESC);

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

UPDATE services
   SET show_in_healthcheck = is_active,
       show_in_webui = has_webui AND open_url <> '#',
       updated_at = NOW();

UPDATE services
   SET health_type = 'http',
       health_url = 'http://127.0.0.1:18790/health',
       updated_at = NOW()
 WHERE slug = 'openviking';

UPDATE services
   SET health_type = 'http',
       health_url = 'http://127.0.0.1:9187/metrics',
       updated_at = NOW()
 WHERE slug = 'pg-exporter';

UPDATE services
   SET health_type = 'http',
       health_url = 'http://127.0.0.1:9121/metrics',
       updated_at = NOW()
 WHERE slug = 'redis-exporter';

INSERT INTO services (
  slug, name, kind, category, description, health_url, health_type, open_url,
  status, icon_type, icon_color, sort_order, is_active, has_webui,
  show_in_healthcheck, show_in_webui
) VALUES (
  'paperclip', 'Paperclip', 'app', 'AI', 'Paperclip company workspace and issue board',
  'http://127.0.0.1:3033/api/health', 'http', '#',
  'unknown', 'auto', '#6366f1', 120, true, true, true, true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  health_url = EXCLUDED.health_url,
  health_type = EXCLUDED.health_type,
  open_url = CASE WHEN services.open_url = '#' THEN EXCLUDED.open_url ELSE services.open_url END,
  has_webui = true,
  show_in_healthcheck = services.is_active,
  show_in_webui = services.is_active AND services.open_url <> '#',
  updated_at = NOW();

INSERT INTO migrations (name) VALUES ('021_paperclip_service_readiness')
ON CONFLICT (name) DO NOTHING;
