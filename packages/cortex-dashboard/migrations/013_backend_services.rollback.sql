-- 013_backend_services.rollback.sql
-- Reverse 013_backend_services.sql. ON CONFLICT made the original idempotent;
-- rollback uses explicit DELETEs scoped to slug so we never touch operator-added
-- rows that happen to share an id.

DELETE FROM service_badges
 WHERE service_id IN (
   SELECT id FROM services
    WHERE slug IN ('cortex-graph', 'cortex-sandbox-runner', 'cortex-consumer')
 );

DELETE FROM services
 WHERE slug IN ('cortex-graph', 'cortex-sandbox-runner', 'cortex-consumer');

DELETE FROM migrations WHERE name = '013_backend_services';
