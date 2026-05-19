-- Paperclip ↔ CortexOS ticket link table.
-- Maps Paperclip run/issue/agent into the CortexOS role + NATS subject namespace.

CREATE TABLE IF NOT EXISTS paperclip_ticket_link (
  id BIGSERIAL PRIMARY KEY,
  paperclip_issue_id TEXT NOT NULL,
  paperclip_run_id   TEXT NOT NULL,
  paperclip_agent_id TEXT NOT NULL,
  cortex_role        TEXT NOT NULL,
  nats_subject       TEXT NOT NULL,
  nats_msg_id        TEXT,
  status             TEXT NOT NULL CHECK (status IN ('open','in_progress','done','failed','cancelled')),
  cost_usd_cents     INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paperclip_run_id)
);

CREATE INDEX IF NOT EXISTS idx_pcl_issue  ON paperclip_ticket_link (paperclip_issue_id);
CREATE INDEX IF NOT EXISTS idx_pcl_status ON paperclip_ticket_link (status);

INSERT INTO migrations (name) VALUES ('005_paperclip_ticket_link') ON CONFLICT DO NOTHING;
