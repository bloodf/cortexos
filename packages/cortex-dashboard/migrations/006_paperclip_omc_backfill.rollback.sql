-- Rollback for 006_paperclip_omc_backfill.
-- Drops the indexes first (the partial unique index depends on the column)
-- before removing the new columns. Existing 005 rows are preserved.

DROP INDEX IF EXISTS idx_pcl_backfilled_at;
DROP INDEX IF EXISTS uq_pcl_omc_task_id;

ALTER TABLE paperclip_ticket_link
  DROP COLUMN IF EXISTS backfilled_at,
  DROP COLUMN IF EXISTS omc_task_id;

DELETE FROM migrations WHERE name = '006_paperclip_omc_backfill';
