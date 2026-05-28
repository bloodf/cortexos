-- Seed: CortexOS Dashboard rebuild catalog.
-- The dashboard catalog describes the new host control/data plane and the
-- transitional Docker services that remain until their sunset criteria are met.

INSERT INTO badges (slug, label, color, text_color) VALUES
  ('ai',          'AI',          '#5b21b6', '#ffffff'),
  ('app',         'App',         '#1d4ed8', '#ffffff'),
  ('db',          'DB',          '#065f46', '#ffffff'),
  ('api',         'API',         '#0e7490', '#ffffff'),
  ('system',      'System',      '#374151', '#ffffff'),
  ('monitoring',  'Monitoring',  '#7c2d12', '#ffffff'),
  ('home',        'Home',        '#15803d', '#ffffff'),
  ('media',       'Media',       '#a21caf', '#ffffff'),
  ('infra',       'Infra',       '#1f2937', '#ffffff'),
  ('network',     'Network',     '#1e40af', '#ffffff'),
  ('storage',     'Storage',     '#854d0e', '#ffffff'),
  ('agent',       'Agent',       '#9d174d', '#ffffff'),
  ('project',     'Project',     '#4338ca', '#ffffff')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  text_color = EXCLUDED.text_color,
  updated_at = NOW();

INSERT INTO services
  (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order)
VALUES
  -- AI/control plane
  ('9router', '9Router', 'service', 'AI', 'http://127.0.0.1:11434/v1/models', 'http', '#', '/opt/cortexos/.secrets/9router.env', 'cloud', 1),
  ('ollama', 'Ollama', 'service', 'AI', 'http://127.0.0.1:11434/api/tags', 'http', '#', NULL, 'cloud', 2),
  ('honcho', 'Honcho', 'service', 'AI', 'honcho', 'process', '#', '/opt/cortexos/.secrets/honcho.env', 'database', 3),
  ('honcho-mcp', 'Honcho MCP', 'service', 'AI', 'honcho-mcp', 'process', '#', '/opt/cortexos/.secrets/honcho.env', 'database', 4),
  ('ollama-honcho-embeddings-proxy', 'Ollama Honcho Embeddings Proxy', 'service', 'AI', 'ollama-honcho-embeddings-proxy', 'process', '#', '/opt/cortexos/.secrets/honcho.env', 'cloud', 5),
  ('agentgateway', 'AgentGateway', 'service', 'AI', 'http://127.0.0.1:18800/health', 'http', '#', '/opt/cortexos/.secrets/agentgateway.env', 'cloud', 6),
  ('kernel-browser', 'Kernel Browser', 'service', 'AI', 'http://127.0.0.1:9222/json/version', 'http', '#', '/opt/cortexos/.secrets/kernel-browser.env', 'browser', 7),
  ('cortex-sandbox-runner', 'Cortex Sandbox Runner', 'service', 'AI', 'http://127.0.0.1:8091/healthz', 'http', '#', '/opt/cortexos/.secrets/sandbox.env', 'cloud', 8),

  -- Infrastructure and administration
  ('caddy', 'Caddy', 'service', 'Infrastructure', 'tcp://127.0.0.1:80', 'tcp', '#', '/opt/cortexos/.secrets/caddy.env', 'caddy', 1),
  ('tailscale', 'Tailscale', 'process', 'Infrastructure', 'tailscaled', 'process', '#', NULL, 'server', 2),
  ('cockpit', 'Cockpit', 'service', 'Infrastructure', 'tcp://127.0.0.1:9093', 'tcp', '#', NULL, 'server', 3), -- port under reconciliation — see docs/rebuild/RECONCILIATION.md G5/C2
  ('webmin', 'Webmin', 'service', 'Infrastructure', 'tcp://127.0.0.1:10000', 'tcp', '#', NULL, 'server', 4),
  ('incus', 'Incus', 'service', 'Infrastructure', 'incusd', 'process', '#', NULL, 'server', 5),
  ('cortex-dashboard', 'Cortex Dashboard', 'service', 'Infrastructure', 'http://127.0.0.1:3080/en/login', 'http', '#', '/opt/cortexos/.secrets/dashboard.env', 'server', 6),
  ('cortex-dashboard-root-helper', 'Dashboard Root Helper', 'service', 'Infrastructure', 'cortex-dashboard-root-helper.socket', 'systemd', '#', NULL, 'server', 7),
  ('dockhand', 'Dockhand', 'docker', 'Infrastructure', 'http://127.0.0.1:3420', 'http', '#', '/opt/cortexos/.secrets/dockhand.env', 'monitor', 8),
  ('watchtower', 'Watchtower', 'docker', 'Infrastructure', 'watchtower', 'docker', '#', NULL, 'monitor', 9),
  ('dnsmasq', 'DNSmasq', 'process', 'Infrastructure', 'dnsmasq', 'process', '#', NULL, 'server', 10),
  ('fail2ban', 'Fail2Ban', 'process', 'Infrastructure', 'fail2ban', 'process', '#', NULL, 'server', 11),

  -- Data plane
  ('postgresql', 'PostgreSQL', 'service', 'Database', 'tcp://127.0.0.1:5432', 'tcp', '#', '/opt/cortexos/.secrets/postgresql.env', 'postgresql', 1),
  ('mysql', 'MySQL', 'service', 'Database', 'tcp://127.0.0.1:3306', 'tcp', '#', '/opt/cortexos/.secrets/mysql.env', 'mysql', 2),
  ('redis', 'Redis', 'service', 'Database', 'tcp://127.0.0.1:6379', 'tcp', '#', '/opt/cortexos/.secrets/redis.env', 'redis', 3),
  ('mongodb', 'MongoDB', 'service', 'Database', 'tcp://127.0.0.1:27017', 'tcp', '#', '/opt/cortexos/.secrets/mongodb.env', 'database', 4),
  ('minio', 'MinIO', 'service', 'Database', 'http://127.0.0.1:9000/minio/health/live', 'http', '#', '/opt/cortexos/.secrets/minio.env', 'database', 5),
  ('rabbitmq', 'RabbitMQ', 'service', 'Database', 'http://127.0.0.1:15672/api/health/checks/local-alarms', 'http', '#', '/opt/cortexos/.secrets/rabbitmq.env', 'database', 6),
  ('pgadmin', 'pgAdmin', 'docker', 'Database', 'http://127.0.0.1:5050/misc/ping', 'http', '#', '/opt/cortexos/.secrets/pgadmin.env', 'postgresql', 7),
  ('phpmyadmin', 'phpMyAdmin', 'docker', 'Database', 'http://127.0.0.1:8082', 'http', '#', '/opt/cortexos/.secrets/phpmyadmin.env', 'mysql', 8),
  ('redisinsight', 'RedisInsight', 'docker', 'Database', 'http://127.0.0.1:5540/api/health', 'http', '#', '/opt/cortexos/.secrets/redisinsight.env', 'redis', 9),
  ('mongo-express', 'Mongo Express', 'docker', 'Database', 'http://127.0.0.1:8083', 'http', '#', '/opt/cortexos/.secrets/mongo-express.env', 'database', 10),

  -- Home/media
  ('home-assistant', 'Home Assistant', 'service', 'Home', 'http://127.0.0.1:8123', 'http', '#', '/opt/cortexos/.secrets/home-assistant.env', 'home', 1),
  ('jellyfin', 'Jellyfin', 'service', 'Media', 'http://127.0.0.1:8096/health', 'http', '#', '/opt/cortexos/.secrets/jellyfin.env', 'jellyfin', 1),

  -- Monitoring
  ('grafana', 'Grafana', 'service', 'Monitoring', 'http://127.0.0.1:3000/api/health', 'http', '#', '/opt/cortexos/.secrets/grafana.env', 'monitor', 1),
  ('prometheus', 'Prometheus', 'service', 'Monitoring', 'http://127.0.0.1:9090/-/healthy', 'http', '#', '/opt/cortexos/.secrets/prometheus.env', 'monitor', 2),
  ('loki', 'Loki', 'service', 'Monitoring', 'http://127.0.0.1:3100/ready', 'http', '#', '/opt/cortexos/.secrets/loki.env', 'monitor', 3),
  ('node-exporter', 'Node Exporter', 'service', 'Monitoring', 'http://127.0.0.1:9100/metrics', 'http', '#', NULL, 'monitor', 4),
  ('cadvisor', 'cAdvisor', 'docker', 'Monitoring', 'http://127.0.0.1:8081/cadvisor/healthz', 'http', '#', NULL, 'monitor', 5),
  ('fluent-bit', 'Fluent Bit', 'service', 'Monitoring', 'fluent-bit', 'process', '#', '/opt/cortexos/.secrets/fluent-bit.env', 'monitor', 6),
  ('promtail', 'Promtail', 'service', 'Monitoring', 'promtail', 'process', '#', NULL, 'monitor', 7),
  ('otel-collector', 'OTel Collector', 'service', 'Monitoring', 'tcp://127.0.0.1:4317', 'tcp', '#', '/opt/cortexos/.secrets/otel.env', 'monitor', 8),
  ('pg-exporter', 'PG Exporter', 'service', 'Monitoring', 'http://127.0.0.1:9187/metrics', 'http', '#', NULL, 'monitor', 9),
  ('mysql-exporter', 'MySQL Exporter', 'service', 'Monitoring', 'http://127.0.0.1:9104/metrics', 'http', '#', NULL, 'monitor', 10),
  ('redis-exporter', 'Redis Exporter', 'service', 'Monitoring', 'http://127.0.0.1:9121/metrics', 'http', '#', NULL, 'monitor', 11),
  ('mongo-exporter', 'Mongo Exporter', 'service', 'Monitoring', 'http://127.0.0.1:9216/metrics', 'http', '#', NULL, 'monitor', 12)
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
  updated_at = NOW();

UPDATE services SET has_webui = true, show_in_webui = true WHERE open_url != '#';
UPDATE services SET has_webui = false, show_in_webui = false WHERE open_url = '#';

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('9router','ollama','honcho','honcho-mcp','ollama-honcho-embeddings-proxy','agentgateway','kernel-browser','cortex-sandbox-runner')
  AND b.slug = 'ai'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('agentgateway','cortex-dashboard-root-helper') AND b.slug = 'agent'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('9router','agentgateway','cortex-sandbox-runner') AND b.slug = 'api'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('caddy','tailscale','cockpit','webmin','incus','cortex-dashboard','cortex-dashboard-root-helper','dockhand','watchtower','dnsmasq','fail2ban')
  AND b.slug = 'infra'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('caddy','tailscale','dnsmasq','incus') AND b.slug = 'network'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('postgresql','mysql','redis','mongodb','minio','rabbitmq','pgadmin','phpmyadmin','redisinsight','mongo-express')
  AND b.slug = 'db'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('minio','postgresql','mysql','redis','mongodb') AND b.slug = 'storage'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('grafana','prometheus','loki','node-exporter','cadvisor','fluent-bit','promtail','otel-collector','pg-exporter','mysql-exporter','redis-exporter','mongo-exporter')
  AND b.slug = 'monitoring'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'home-assistant' AND b.slug = 'home'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'jellyfin' AND b.slug = 'media'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('cockpit','webmin','tailscale','dnsmasq','fail2ban','watchtower','incus')
  AND b.slug = 'system'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO migrations (name) VALUES ('002_seed')
ON CONFLICT DO NOTHING;
