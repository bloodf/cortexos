ALTER TABLE action_log
  DROP CONSTRAINT IF EXISTS action_log_target_type_check;

ALTER TABLE action_log
  ADD CONSTRAINT action_log_target_type_check
  CHECK (target_type IN ('docker','systemd'));
