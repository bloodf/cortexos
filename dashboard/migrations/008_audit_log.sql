-- 008_audit_log — hash-chained audit hypertable.
--
-- Introduces a TimescaleDB-backed `audit_log` hypertable that stores every
-- security-relevant CortexOS state transition as an append-only entry with
-- a SHA-256 hash chain. Latest chain heads are periodically anchored into
-- the public Sigstore Rekor transparency log so any tampering with the
-- history of audit rows becomes externally detectable.
--
-- Hash chain:
--   payload_hash = SHA-256( JCS(payload) )
--   chain_hash   = SHA-256( prev_hash || payload_hash )
--
-- Genesis row uses prev_hash = 64 hex zeros. See docs/AUDIT.md for the full
-- threat model, concurrency contract, and tamper-detection runbook.
--
-- Operator note: this migration assumes the TimescaleDB extension is
-- available on the target Postgres instance (image:
-- `timescale/timescaledb-ha:pg16`). The rollback drops the table+indexes
-- but intentionally leaves the extension in place because it may be shared
-- with other hypertables.

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

-- Promote to a hypertable. `if_not_exists` keeps the migration idempotent
-- across re-runs and partial-failure recoveries.
SELECT create_hypertable('audit_log', 'occurred_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type
  ON audit_log (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_subject
  ON audit_log (subject, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_chain_head
  ON audit_log (occurred_at DESC, id DESC);

INSERT INTO migrations (name) VALUES ('008_audit_log') ON CONFLICT DO NOTHING;
