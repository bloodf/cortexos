-- Rollback for 003_incus_instances.sql.
-- NOTE: this directory is intentionally OUTSIDE the migrations scan path
-- (src/lib/db/migrate.ts uses a non-recursive readdir of migrations/), so
-- rollbacks are never auto-applied. Run by hand against the database.
DROP INDEX IF EXISTS idx_incus_instances_slug;
DROP INDEX IF EXISTS idx_incus_instances_status;
DROP TABLE IF EXISTS incus_instances;
DELETE FROM config WHERE key IN ('incus.wizard.defaults', 'incus.ai.model');
