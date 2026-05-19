-- 015_service_health_targets.rollback.sql
-- Data-only migration; previous health targets are not reconstructed. Static
-- seed migrations reapply canonical defaults on a fresh database.
DELETE FROM migrations WHERE name = '015_service_health_targets';
