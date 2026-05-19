-- Rollback for 010_services_catalog_extras.
-- Drops the rows added by the migration and the related badge links.

DELETE FROM service_badges
WHERE service_id IN (SELECT id FROM services WHERE slug IN ('langfuse','nats-monitor'));

DELETE FROM services WHERE slug IN ('langfuse','nats-monitor');

DELETE FROM migrations WHERE name = '010_services_catalog_extras';
