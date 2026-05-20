-- Seed: CortexOS Dashboard v1.0 (public-safe; no-vault; no personal projects)

-- ============================================================
-- Badge catalog (WCAG AA: contrast >= 4.5:1)
-- ============================================================
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
  ('agent',       'Agent',       '#9d174d', '#ffffff')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  text_color = EXCLUDED.text_color,
  updated_at = NOW();

-- ============================================================
-- Services
-- env_source: live VPS env file path (NULL when none).
-- kind:       docker | service | process | app
-- ============================================================

-- AI
INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order) VALUES
  ('9router',        '9Router',        'service', 'AI', 'http://127.0.0.1:11434/api/health',    'http',    '#', '/opt/cortexos/.secrets/9router.env',       'cloud',    1),
  ('openviking',     'OpenViking',     'service', 'AI', 'http://127.0.0.1:18790/health',                    'http',    '#', '/opt/cortexos/.secrets/openviking.env',     'cloud',    2),
  ('openclaw',       'OpenClaw',       'service', 'AI', 'http://127.0.0.1:18789/health',                    'http',    '#', '/opt/cortexos/.secrets/openclaw-gateway.env',       'brain',    3),
  ('agentgateway',   'AgentGateway',   'service', 'AI', 'http://127.0.0.1:18800/health',                    'http',    '#', '/opt/cortexos/.secrets/agentgateway.env',   'cloud',    4),
  ('kernel-browser', 'Kernel Browser', 'docker',  'AI', 'http://127.0.0.1:9222/json/version',              'http',    '#', '/opt/cortexos/.secrets/kernel-browser.env', 'browser',  5),
  ('leann',          'LEANN',          'service', 'AI', 'http://127.0.0.1:18791/health',                    'http',    '#', '/opt/cortexos/.secrets/leann.env',                                     'database', 6)
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

-- Infrastructure
INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order) VALUES
  ('caddy',      'Caddy',      'service', 'Infrastructure', 'tcp://127.0.0.1:8080',                       'tcp',     '#', '/opt/cortexos/stacks/caddy/.env',  'caddy',   1),
  ('floci',      'Floci',      'docker',  'Infrastructure', 'http://host.docker.internal:4566/_localstack/health', 'http',    '#', '/opt/cortexos/stacks/floci/.env',  'cloud',   2),
  ('cockpit',    'Cockpit',    'service', 'Infrastructure', 'tcp://host.docker.internal:9093',                     'tcp',     '#', NULL,                             'server',  3),
  ('webmin',     'Webmin',     'service', 'Infrastructure', 'tcp://host.docker.internal:10000',                    'tcp',     '#', NULL,                             'server',  4),
  ('watchtower', 'Watchtower', 'docker',  'Infrastructure', 'watchtower',                                          'docker',  '#', NULL,                             'monitor', 5),
  ('tailscale',  'Tailscale',  'process', 'Infrastructure', 'tailscaled',                                          'process', '#', NULL,                             'server',  6),
  ('dnsmasq',    'DNSmasq',    'process', 'Infrastructure', 'dnsmasq',                                             'process', '#', NULL,                             'server',  7),
  ('fail2ban',   'Fail2Ban',   'process', 'Infrastructure', 'fail2ban',                                            'process', '#', NULL,                             'server',  8)
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

-- Database (MySQL excluded per policy; MongoDB retained pending questionnaire flag)
INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order) VALUES
  ('postgresql', 'PostgreSQL', 'docker',  'Database', 'tcp://host.docker.internal:5432',          'tcp',  '#', '/opt/cortexos/.secrets/postgres.env', 'postgresql', 1),
  ('redis',      'Redis',      'docker',  'Database', 'tcp://host.docker.internal:6379',          'tcp',  '#', '/opt/cortexos/.secrets/redis.env',    'redis',      2),
  ('mongodb',    'MongoDB',    'docker',  'Database', 'tcp://host.docker.internal:27017',         'tcp',  '#', '/opt/cortexos/.secrets/mongodb.env',  'database',   3),
  ('nats',       'NATS',       'docker',  'Database', 'http://host.docker.internal:8222/healthz', 'http', '#', '/opt/cortexos/.secrets/nats.env',     'database',   4)
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

-- Home
INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order) VALUES
  ('home-assistant', 'Home Assistant', 'docker', 'Home', 'http://host.docker.internal:8123', 'http', '#', '/opt/cortexos/stacks/home-assistant/.env', 'home', 1)
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

-- Media
INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order) VALUES
  ('jellyfin', 'Jellyfin', 'docker', 'Media', 'http://host.docker.internal:8096/health', 'http', '#', '/opt/cortexos/stacks/jellyfin/.env', 'jellyfin', 1)
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

-- Monitoring (MySQL exporter excluded with MySQL)
INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order) VALUES
  ('dockhand',       'Dockhand',       'docker',  'Monitoring', 'http://127.0.0.1:3420',            'http',    '#', '/opt/cortexos/stacks/dockhand/.env',       'monitor', 1),
  ('grafana',        'Grafana',        'service', 'Monitoring', 'http://127.0.0.1:3000/api/health', 'http',    '#', '/opt/cortexos/stacks/grafana/.env',        'monitor', 2),
  ('prometheus',     'Prometheus',     'service', 'Monitoring', 'http://127.0.0.1:9090/-/healthy',  'http',    '#', '/opt/cortexos/stacks/prometheus/.env',     'monitor', 3),
  ('loki',           'Loki',           'service', 'Monitoring', 'http://127.0.0.1:3100/ready',      'http',    '#', '/opt/cortexos/stacks/loki/.env',           'monitor', 4),
  ('fluent-bit',     'Fluent Bit',     'service', 'Monitoring', 'fluent-bit',                                  'process',  '#', '/opt/cortexos/stacks/fluent-bit/.env',     'monitor', 5),
  ('promtail',       'Promtail',       'process', 'Monitoring', 'promtail',                                    'process', '#', NULL,                                     'monitor', 6),
  ('cadvisor',       'cAdvisor',       'docker',  'Monitoring', 'http://127.0.0.1:8081/metrics',    'http',    '#', NULL,                                     'monitor', 7),
  ('node-exporter',  'Node Exporter',  'service', 'Monitoring', 'http://127.0.0.1:9100/metrics',    'http',    '#', NULL,                                     'monitor', 8),
  ('otel-collector', 'OTel Collector', 'docker',  'Monitoring', 'tcp://host.docker.internal:4317',             'tcp',     '#', '/opt/cortexos/stacks/otel/.env',           'monitor', 9),
  ('pg-exporter',    'PG Exporter',    'docker',  'Monitoring', 'http://127.0.0.1:9187/metrics',    'http',    '#', '/opt/cortexos/stacks/pg-exporter/.env',    'monitor', 10),
  ('redis-exporter', 'Redis Exporter', 'docker',  'Monitoring', 'http://127.0.0.1:9121/metrics',    'http',    '#', '/opt/cortexos/stacks/redis-exporter/.env', 'monitor', 11),
  ('mongo-exporter', 'Mongo Exporter', 'docker',  'Monitoring', 'http://127.0.0.1:9216/metrics',    'http',    '#', '/opt/cortexos/stacks/mongo-exporter/.env', 'monitor', 12)
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

-- Dashboard (self)
INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order) VALUES
  ('cortex-dashboard', 'Cortex Dashboard', 'service', 'Infrastructure', 'http://127.0.0.1:3080/api/health', 'http', '#', '/opt/cortexos/.secrets/dashboard.env', 'server', 9)
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

-- Utility
INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order) VALUES
  ('email-spam-poll', 'Email Spam Filter', 'process', 'Utility', 'email_spam_poll', 'process', '#', NULL, 'server', 1)
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

-- Webui flags
UPDATE services SET has_webui = true,  show_in_webui = true  WHERE open_url != '#';
UPDATE services SET has_webui = false, show_in_webui = false WHERE open_url  = '#';

-- ============================================================
-- service_badges: tag seeded services with catalog badges
-- ============================================================

-- AI category
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('9router','openviking','openclaw','agentgateway','kernel-browser','leann')
  AND b.slug = 'ai'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('openclaw','agentgateway')
  AND b.slug = 'agent'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('9router','agentgateway')
  AND b.slug = 'api'
ON CONFLICT (service_id, badge_id) DO NOTHING;

-- Infrastructure
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('caddy','floci','cockpit','webmin','watchtower','tailscale','dnsmasq','fail2ban','cortex-dashboard')
  AND b.slug = 'infra'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('caddy','tailscale','dnsmasq')
  AND b.slug = 'network'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('cockpit','webmin','tailscale','dnsmasq','fail2ban','watchtower')
  AND b.slug = 'system'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'cortex-dashboard' AND b.slug = 'app'
ON CONFLICT (service_id, badge_id) DO NOTHING;

-- Database
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('postgresql','redis','mongodb','nats')
  AND b.slug = 'db'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('postgresql','mongodb')
  AND b.slug = 'storage'
ON CONFLICT (service_id, badge_id) DO NOTHING;

-- Home
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'home-assistant' AND b.slug IN ('home','app')
ON CONFLICT (service_id, badge_id) DO NOTHING;

-- Media
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'jellyfin' AND b.slug IN ('media','app')
ON CONFLICT (service_id, badge_id) DO NOTHING;

-- Monitoring
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN (
    'dockhand','grafana','prometheus','loki','fluent-bit','promtail',
    'cadvisor','node-exporter','otel-collector','pg-exporter','redis-exporter','mongo-exporter'
  )
  AND b.slug = 'monitoring'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('grafana','dockhand')
  AND b.slug = 'app'
ON CONFLICT (service_id, badge_id) DO NOTHING;

-- ============================================================
-- projects: empty seed (personal projects never in public repo)
-- messaging_routes: empty seed
-- ============================================================

-- Config
INSERT INTO config (key, value) VALUES
  ('refresh_interval', '1000'),
  ('theme', 'dark'),
  ('hostname', 'cortex')
ON CONFLICT (key) DO NOTHING;

-- Dashboard layout
INSERT INTO dashboard_layouts (user_id, layout)
VALUES (1, '{"rows":[{"items":["cpu-gauge","memory-gauge","storage-gauge"]},{"items":["service-online","service-offline","service-idle"]},{"items":["uptime","docker-status","alerts"]},{"items":["live-performance","top-processes"]},{"items":["network-graph"]},{"items":["total-download","total-upload"]}]}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Default admin user
-- Default admin: admin / 12345678 — operator MUST change via /admin/account on first login
-- Hash generated via: node -e 'console.log(require("bcryptjs").hashSync("12345678",10))'
-- ============================================================
INSERT INTO admin_users (username, password_hash, is_admin)
VALUES ('admin', '$2b$10$A7llpDGfeZc4eHVsGbC6.excbMKkNRI5nC7Cz8mySg0U6eOe50V1e', TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO migrations (name) VALUES ('002_seed')
ON CONFLICT (name) DO NOTHING;
