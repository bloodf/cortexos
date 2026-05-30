-- Rollback for 008_audit_log.
--
-- Drops the audit hypertable + indexes. The TimescaleDB extension is NOT
-- removed because other hypertables may depend on it; reverting the
-- extension is an explicit operator decision, not an automatic rollback.
--
-- Destructive: deletes the full hash-chained audit history. Take a
-- `pg_dump` of `audit_log` first if forensic preservation is required.

DROP INDEX IF EXISTS idx_audit_log_chain_head;
DROP INDEX IF EXISTS idx_audit_log_subject;
DROP INDEX IF EXISTS idx_audit_log_event_type;

DROP TABLE IF EXISTS audit_log;

DELETE FROM migrations WHERE name = '008_audit_log';
