-- Rollback for 009_pending_approvals.
--
-- Drops the table + indexes. The signal stream `CORTEX_SIGNALS` is owned
-- by NATS and is unaffected by this rollback — replay is still possible
-- from JetStream's last-per-subject semantics.

DROP INDEX IF EXISTS idx_pending_approvals_run_id;
DROP INDEX IF EXISTS idx_pending_approvals_open;

DROP TABLE IF EXISTS pending_approvals;

DELETE FROM migrations WHERE name = '009_pending_approvals';
