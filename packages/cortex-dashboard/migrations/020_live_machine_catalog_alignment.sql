-- Align the persisted service catalog with the port-based, Tailscale Serve
-- runtime model used on the homelab host.

UPDATE services
   SET health_url = 'http://127.0.0.1:9090/-/healthy',
       updated_at = NOW()
 WHERE slug = 'prometheus';

UPDATE services
   SET health_url = 'http://127.0.0.1:11434/v1/models',
       updated_at = NOW()
 WHERE slug = '9router';

UPDATE services
   SET health_url = 'http://127.0.0.1:18790/health',
       open_url = regexp_replace(open_url, ':8020/?$', ':8020/health'),
       updated_at = NOW()
 WHERE slug = 'openviking';

UPDATE services
   SET health_url = 'http://127.0.0.1:8081/metrics',
       updated_at = NOW()
 WHERE slug = 'cadvisor';

UPDATE services
   SET health_url = 'http://127.0.0.1:5050/misc/ping',
       updated_at = NOW()
 WHERE slug = 'pgadmin';

UPDATE services
   SET health_url = 'http://127.0.0.1:8083/',
       updated_at = NOW()
 WHERE slug = 'mongo-express';

UPDATE services
   SET is_active = true,
       show_in_webui = has_webui AND open_url <> '#',
       updated_at = NOW()
 WHERE slug IN ('pgadmin', 'redisinsight', 'mongo-express', 'phpmyadmin');

INSERT INTO migrations (name) VALUES ('020_live_machine_catalog_alignment')
ON CONFLICT (name) DO NOTHING;
