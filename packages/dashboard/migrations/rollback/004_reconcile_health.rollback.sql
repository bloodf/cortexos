-- Rollback for 004_reconcile_health: restore the original seeded health checks.
-- Lives under migrations/rollback/ which the runner does not auto-scan.

UPDATE services
   SET health_type = 'tcp', health_url = 'tcp://127.0.0.1:80', updated_at = NOW()
 WHERE slug = 'caddy';


UPDATE services
   SET health_type = 'http', health_url = 'http://127.0.0.1:9090/-/healthy', updated_at = NOW()
 WHERE slug = 'prometheus';

UPDATE services
   SET health_type = 'http', health_url = 'http://127.0.0.1:9222/json/version', updated_at = NOW()
 WHERE slug = 'kernel-browser';


UPDATE services
   SET is_active = true, updated_at = NOW()
 WHERE slug = 'hermes-dashboard';

DELETE FROM migrations WHERE name = '004_reconcile_health';
