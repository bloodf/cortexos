-- Cortex Mail Guardian state.
-- Stores redacted features and owner decisions only. Raw email bodies,
-- subjects, IMAP passwords, and Telegram tokens stay out of Postgres.

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

INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order)
VALUES (
  'cortex-mail-guardian',
  'Cortex Mail Guardian',
  'service',
  'AI',
  'cortex-mail-guardian.service',
  'systemd',
  '#',
  '/opt/cortexos/.secrets/mail-guardian.env',
  'mail',
  9
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  category = EXCLUDED.category,
  health_url = EXCLUDED.health_url,
  health_type = EXCLUDED.health_type,
  open_url = EXCLUDED.open_url,
  env_source = EXCLUDED.env_source,
  icon_type = EXCLUDED.icon_type,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO migrations (name) VALUES ('004_mail_guardian')
ON CONFLICT (name) DO NOTHING;
