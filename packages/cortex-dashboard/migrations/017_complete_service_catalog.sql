-- Complete service catalog for native/container split and missing DB admin tools.

INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order, is_active, has_webui, show_in_webui, show_in_healthcheck)
VALUES
  ('pgadmin', 'pgAdmin', 'docker', 'Database', 'http://127.0.0.1:5050/pgadmin/misc/ping', 'http', '#', '/opt/cortexos/.secrets/pgadmin.env', 'database', 20, true, true, true, true),
  ('redisinsight', 'RedisInsight', 'docker', 'Database', 'http://127.0.0.1:5540', 'http', 'http://100.109.20.9:5540', NULL, 'database', 21, true, true, true, true),
  ('mongo-express', 'mongo-express', 'docker', 'Database', 'http://127.0.0.1:8083/mongo-admin/', 'http', '#', '/opt/cortexos/.secrets/mongodb.env', 'database', 22, true, true, true, true),
  ('mysql', 'MySQL', 'docker', 'Database', 'tcp://127.0.0.1:3306', 'tcp', '#', '/opt/cortexos/.secrets/mysql.env', 'database', 23, true, false, false, true),
  ('phpmyadmin', 'phpMyAdmin', 'docker', 'Database', 'http://127.0.0.1:8082', 'http', '#', NULL, 'database', 24, true, true, true, true),
  ('paperclip-bridge', 'Paperclip Bridge', 'service', 'AI', 'http://127.0.0.1:8089/healthz', 'http', '#', '/opt/cortexos/.secrets/paperclip.env', 'cloud', 25, true, false, false, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  category = EXCLUDED.category,
  health_url = EXCLUDED.health_url,
  health_type = EXCLUDED.health_type,
  open_url = EXCLUDED.open_url,
  env_source = EXCLUDED.env_source,
  icon_type = EXCLUDED.icon_type,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  has_webui = EXCLUDED.has_webui,
  show_in_webui = EXCLUDED.show_in_webui,
  show_in_healthcheck = EXCLUDED.show_in_healthcheck,
  updated_at = NOW();

UPDATE services SET kind = 'docker', health_url = 'tcp://127.0.0.1:5432', env_source = '/opt/cortexos/.secrets/postgres.env' WHERE slug = 'postgresql';
UPDATE services SET kind = 'docker', health_url = 'tcp://127.0.0.1:6379', env_source = '/opt/cortexos/.secrets/redis.env' WHERE slug = 'redis';
UPDATE services SET kind = 'docker', health_url = 'tcp://127.0.0.1:27017', env_source = '/opt/cortexos/.secrets/mongodb.env' WHERE slug = 'mongodb';
UPDATE services SET kind = 'docker', health_url = 'http://127.0.0.1:8222/healthz' WHERE slug = 'nats';
UPDATE services SET kind = 'docker', health_url = 'http://127.0.0.1:8090/healthz', open_url = '#', has_webui = false, show_in_webui = false WHERE slug = 'cortex-graph';
UPDATE services SET kind = 'docker' WHERE slug IN ('langfuse', 'cortex-consumer', 'openviking');
UPDATE services SET kind = 'service', health_type = 'http', health_url = 'http://127.0.0.1:18800/health' WHERE slug = 'agentgateway';
UPDATE services SET kind = 'service' WHERE slug IN ('leann', 'openclaw', '9router');
UPDATE services SET has_webui = false, show_in_webui = false WHERE slug = 'loki';
UPDATE services SET open_url = 'http://100.109.20.9:3001' WHERE slug = 'langfuse';
DELETE FROM services WHERE slug IN ('promtail', 'email-spam-poll');

DROP FUNCTION IF EXISTS cortex_set_service_urls(TEXT);
CREATE OR REPLACE FUNCTION cortex_set_service_urls(base_url TEXT)
RETURNS void AS $$
DECLARE
  normalized TEXT := regexp_replace(base_url, '/+$', '');
BEGIN
  UPDATE services SET open_url = normalized || '/' WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = normalized || '/grafana/' WHERE slug = 'grafana';
  UPDATE services SET open_url = normalized || '/prometheus/' WHERE slug = 'prometheus';
  UPDATE services SET open_url = normalized || '/cadvisor/' WHERE slug = 'cadvisor';
  UPDATE services SET open_url = normalized || '/nats/' WHERE slug = 'nats-monitor';
  UPDATE services SET open_url = normalized || '/9router/' WHERE slug = '9router';
  UPDATE services SET open_url = normalized || '/openclaw/' WHERE slug = 'openclaw';
  UPDATE services SET open_url = normalized || '/openviking/' WHERE slug = 'openviking';
  UPDATE services SET open_url = normalized || '/leann/' WHERE slug = 'leann';
  UPDATE services SET open_url = normalized || '/graph/' WHERE slug = 'cortex-graph';
  UPDATE services SET open_url = normalized || '/pgadmin/' WHERE slug = 'pgadmin';
  UPDATE services SET open_url = normalized || '/mongo-admin/' WHERE slug = 'mongo-express';
  UPDATE services SET open_url = normalized || '/phpmyadmin/' WHERE slug = 'phpmyadmin';
  UPDATE services SET open_url = 'http://100.109.20.9:5540' WHERE slug = 'redisinsight';
  UPDATE services SET open_url = 'http://100.109.20.9:3001' WHERE slug = 'langfuse';
  UPDATE services SET has_webui = open_url <> '#', show_in_webui = is_active AND open_url <> '#';
  UPDATE services SET has_webui = false, show_in_webui = false WHERE slug = 'loki';
END;
$$ LANGUAGE plpgsql;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('pgadmin','redisinsight','mongo-express','mysql','phpmyadmin') AND b.slug = 'db'
ON CONFLICT (service_id, badge_id) DO NOTHING;
