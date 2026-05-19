-- 009_pending_approvals — V12 NATS-signal approvals queue.
--
-- The cortex-consumer writes a row here every time a destructive op enters
-- `awaitSignal(runId, 'approval', timeout)`. The dashboard `/approvals` page
-- reads from this table to render the operator queue, and the
-- `POST /api/paperclip/approve` server action publishes a signal +
-- best-effort DELETEs the row once an operator decides.
--
-- The signal itself remains the source of truth — this table is a
-- materialized view of "what is currently awaiting input" so the UI does
-- not need to scan JetStream consumer state on every request. Stale rows
-- are reaped by:
--   1. Consumer-side: on signal receipt or timeout.
--   2. Operator-side: explicit deny via dashboard.
--
-- Cross-reference: schemas/cortex-signal-v1.json, prompts/paperclip/governance.

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

INSERT INTO migrations (name) VALUES ('009_pending_approvals')
ON CONFLICT DO NOTHING;
