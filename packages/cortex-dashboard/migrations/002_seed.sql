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
  ('obot', 'Obot', 'service', 'AI', 'http://127.0.0.1:8090/', 'http', '#', '/opt/cortexos/.secrets/obot.env', 'cloud', 6),
  ('kernel-browser', 'Kernel Browser', 'service', 'AI', 'http://127.0.0.1:9222/json/version', 'http', '#', '/opt/cortexos/.secrets/kernel-browser.env', 'browser', 7),
  ('cortex-sandbox-runner', 'Cortex Sandbox Runner', 'service', 'AI', 'http://127.0.0.1:8091/healthz', 'http', '#', '/opt/cortexos/.secrets/sandbox.env', 'cloud', 8),
  ('hermes-dashboard', 'Hermes Dashboard', 'service', 'AI', 'http://127.0.0.1:9119/', 'http', '#', NULL, 'monitor', 10),

  -- Infrastructure and administration
  ('caddy', 'Caddy', 'service', 'Infrastructure', 'tcp://127.0.0.1:80', 'tcp', '#', '/opt/cortexos/.secrets/caddy.env', 'caddy', 1),
  ('tailscale', 'Tailscale', 'process', 'Infrastructure', 'tailscaled', 'process', '#', NULL, 'server', 2),
  ('cockpit', 'Cockpit', 'service', 'Infrastructure', 'tcp://127.0.0.1:9091', 'tcp', '#', NULL, 'server', 3), -- moved off :9090 (Prometheus owns it); cockpit.socket.d/listen.conf binds 127.0.0.1:9091
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
  ('node-exporter', 'Node Exporter', 'docker', 'Monitoring', 'http://127.0.0.1:9100/metrics', 'http', '#', NULL, 'monitor', 4),
  ('cadvisor', 'cAdvisor', 'docker', 'Monitoring', 'http://127.0.0.1:8081/cadvisor/healthz', 'http', '#', NULL, 'monitor', 5),
  ('fluent-bit', 'Fluent Bit', 'docker', 'Monitoring', 'cortex-fluent-bit', 'docker', '#', NULL, 'monitor', 6),
  ('otel-collector', 'OTel Collector', 'docker', 'Monitoring', 'tcp://127.0.0.1:4317', 'tcp', '#', '/opt/cortexos/.secrets/otel.env', 'monitor', 7),
  ('pg-exporter', 'PG Exporter', 'docker', 'Monitoring', 'http://127.0.0.1:9187/metrics', 'http', '#', NULL, 'monitor', 8),
  ('mysql-exporter', 'MySQL Exporter', 'docker', 'Monitoring', 'http://127.0.0.1:9104/metrics', 'http', '#', NULL, 'monitor', 9),
  ('redis-exporter', 'Redis Exporter', 'docker', 'Monitoring', 'http://127.0.0.1:9121/metrics', 'http', '#', NULL, 'monitor', 10),
  ('mongo-exporter', 'Mongo Exporter', 'docker', 'Monitoring', 'http://127.0.0.1:9216/metrics', 'http', '#', NULL, 'monitor', 11),
  ('cortex-mail-guardian', 'Cortex Mail Guardian', 'service', 'AI', 'cortex-mail-guardian.service', 'systemd', '#', '/opt/cortexos/.secrets/mail-guardian.env', 'mail', 9),
  ('snmp-exporter', 'SNMP Exporter', 'docker', 'Monitoring', 'http://127.0.0.1:9116/metrics', 'http', '#', NULL, 'monitor', 13),
  ('adguard-exporter', 'AdGuard Exporter', 'docker', 'Monitoring', 'http://127.0.0.1:9617/metrics', 'http', '#', NULL, 'monitor', 14)
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
WHERE s.slug IN ('9router','ollama','honcho','honcho-mcp','ollama-honcho-embeddings-proxy','obot','kernel-browser','cortex-sandbox-runner','hermes-dashboard')
  AND b.slug = 'ai'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('obot','cortex-dashboard-root-helper') AND b.slug = 'agent'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('9router','obot','cortex-sandbox-runner') AND b.slug = 'api'
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
WHERE s.slug IN ('postgresql','mysql','redis','mongodb','pgadmin','phpmyadmin','redisinsight','mongo-express')
  AND b.slug = 'db'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('postgresql','mysql','redis','mongodb') AND b.slug = 'storage'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('grafana','prometheus','loki','node-exporter','cadvisor','fluent-bit','otel-collector','pg-exporter','mysql-exporter','redis-exporter','mongo-exporter')
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

-- Mail guardian visibility flags (was 020_mail_guardian)
UPDATE services SET
  is_active = true,
  has_webui = false,
  show_in_webui = false,
  show_in_healthcheck = true
WHERE slug = 'cortex-mail-guardian';

-- cadvisor not deployed on host (was 025_cadvisor_inactive)
UPDATE services SET is_active = false, updated_at = NOW() WHERE slug = 'cadvisor';

UPDATE services SET has_webui = false, show_in_webui = false
WHERE slug IN ('snmp-exporter', 'adguard-exporter');

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'cortex-mail-guardian' AND b.slug = 'ai'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('snmp-exporter', 'adguard-exporter') AND b.slug = 'monitoring'
ON CONFLICT (service_id, badge_id) DO NOTHING;

-- Default dashboard widgets (was 022_mail_guardian_widgets)
UPDATE dashboard_layouts
SET layout = jsonb_set(
  layout::jsonb,
  '{rows}',
  (layout::jsonb->'rows') || '[{"items":["mail-guardian","mail-guardian-reviews"]}]'::jsonb,
  true
),
updated_at = NOW()
WHERE user_id = 1
  AND NOT (layout::jsonb::text LIKE '%mail-guardian%');

-- Public URL resolver — native-port Tailscale Serve URLs (no Caddy subpaths)
CREATE OR REPLACE FUNCTION cortex_set_service_urls(base_url text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  affected integer := 0;
  base text;
BEGIN
  IF base_url IS NULL OR length(trim(base_url)) = 0 THEN
    RAISE EXCEPTION 'cortex_set_service_urls: base_url is required';
  END IF;
  -- Extract scheme+host (strip port and path) for per-service port URLs.
  base := regexp_replace(base_url, '(https?://[^:/]+).*', '\1');

  UPDATE services SET open_url = base_url                       WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = base || ':11434/'              WHERE slug = '9router';
  UPDATE services SET open_url = base || ':3420'                WHERE slug = 'dockhand';
  UPDATE services SET open_url = base || ':3000/'               WHERE slug = 'grafana';
  UPDATE services SET open_url = base || ':9090/'               WHERE slug = 'prometheus';
  UPDATE services SET open_url = base || ':3100/'               WHERE slug = 'loki';
  UPDATE services SET open_url = base || ':8081/'               WHERE slug = 'cadvisor';
  UPDATE services SET open_url = base || ':8096'                WHERE slug = 'jellyfin';
  UPDATE services SET open_url = base || ':8123'                WHERE slug = 'home-assistant';
  UPDATE services SET open_url = base || ':9091/'               WHERE slug = 'cockpit';
  UPDATE services SET open_url = base || ':10000/'              WHERE slug = 'webmin';
  UPDATE services SET open_url = base || ':5050/'               WHERE slug = 'pgadmin';
  UPDATE services SET open_url = base || ':8082/'               WHERE slug = 'phpmyadmin';
  UPDATE services SET open_url = base || ':5540/'               WHERE slug = 'redisinsight';
  UPDATE services SET open_url = base || ':8083'                WHERE slug = 'mongo-express';
  UPDATE services SET open_url = base || ':8090/'               WHERE slug = 'obot';
  UPDATE services SET open_url = base || ':9119/'               WHERE slug = 'hermes-dashboard';

  UPDATE services SET open_url = '#' WHERE slug IN (
    'ollama','honcho','honcho-mcp','ollama-honcho-embeddings-proxy',
    'kernel-browser','cortex-sandbox-runner',
    'postgresql','mysql','redis','mongodb','caddy','tailscale','incus',
    'cortex-dashboard-root-helper','watchtower','dnsmasq','fail2ban',
    'node-exporter','fluent-bit','otel-collector',
    'pg-exporter','mysql-exporter','redis-exporter','mongo-exporter',
    'cortex-mail-guardian','snmp-exporter','adguard-exporter'
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

INSERT INTO migrations (name) VALUES ('002_seed')
ON CONFLICT (name) DO NOTHING;

INSERT INTO migrations (name) VALUES
  ('003_retention'),
  ('004_tailscale_urls'),
  ('008_audit_log'),
  ('009_pending_approvals'),
  ('010_services_catalog_extras'),
  ('011_services_open_url_paths'),
  ('012_catalog_fixes'),
  ('013_backend_services'),
  ('014_dynamic_service_visibility'),
  ('015_service_health_targets'),
  ('016_placeholder'),
  ('017_retired_infra_cleanup'),
  ('018_dashboard_command_audit'),
  ('019_mongo_admin_url_fix'),
  ('020_mail_guardian'),
  ('021_mail_guardian_actions'),
  ('022_mail_guardian_widgets'),
  ('023_action_log_mail_guardian_target'),
  ('024_cockpit_port_fix'),
  ('025_cadvisor_inactive'),
  ('026_agentgateway_to_obot'),
  ('027_exporter_catalog')
ON CONFLICT (name) DO NOTHING;
