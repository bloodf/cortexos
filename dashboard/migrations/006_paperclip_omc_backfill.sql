-- Historic OMC → Paperclip backfill columns on paperclip_ticket_link.
-- Adds an idempotency key for synthetic OMC tasks and a marker for when
-- the row was created by the offline backfill importer.

ALTER TABLE paperclip_ticket_link
  ADD COLUMN IF NOT EXISTS omc_task_id TEXT,
  ADD COLUMN IF NOT EXISTS backfilled_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcl_omc_task_id
  ON paperclip_ticket_link (omc_task_id)
  WHERE omc_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcl_backfilled_at
  ON paperclip_ticket_link (backfilled_at)
  WHERE backfilled_at IS NOT NULL;

INSERT INTO migrations (name) VALUES ('006_paperclip_omc_backfill') ON CONFLICT DO NOTHING;
