-- 023_enable_all_services_health.sql
-- Legacy compatibility repair for exporter/OpenViking health checks.

UPDATE services SET health_type = 'process', health_url = 'openviking' WHERE slug = 'openviking';
UPDATE services SET health_type = 'docker', health_url = 'cortex-pg-exporter' WHERE slug IN ('pg-exporter', 'postgres-exporter');
UPDATE services SET health_type = 'docker', health_url = 'cortex-redis-exporter' WHERE slug IN ('redis-exporter', 'redis-exportes');

INSERT INTO migrations (name) VALUES
  ('019_enable_all_services_health'),
  ('023_enable_all_services_health')
ON CONFLICT (name) DO NOTHING;
