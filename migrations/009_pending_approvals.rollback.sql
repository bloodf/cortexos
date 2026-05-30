DROP INDEX IF EXISTS idx_pending_approvals_run_id;
DROP INDEX IF EXISTS idx_pending_approvals_open;
DROP TABLE IF EXISTS pending_approvals;
DELETE FROM migrations WHERE name = '009_pending_approvals';
