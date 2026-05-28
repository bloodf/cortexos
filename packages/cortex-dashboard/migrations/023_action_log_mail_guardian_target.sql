-- Expand action_log.target_type CHECK constraint to allow all live target types.
-- 001_schema.sql only has ('docker','systemd'). The live codebase uses
-- 'updates', 'local-user', and 'mail-guardian' as well. This migration
-- drops the old constraint and re-adds it with the full set.

ALTER TABLE action_log
  DROP CONSTRAINT IF EXISTS action_log_target_type_check;

ALTER TABLE action_log
  ADD CONSTRAINT action_log_target_type_check
  CHECK (target_type IN ('docker','systemd','updates','local-user','mail-guardian'));

INSERT INTO migrations (name) VALUES ('023_action_log_mail_guardian_target')
ON CONFLICT (name) DO NOTHING;
