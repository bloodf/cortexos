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
  ('9router',        '9Router',        'service', 'AI', 'http://127.0.0.1:11434/v1/models',    'http',    '#', '/opt/cortexos/.secrets/9router.env',       'cloud',    1),
  ('honcho',         'Honcho',         'docker',  'AI', 'http://127.0.0.1:18690/health',       'http',    '#', '/opt/cortexos/.secrets/honcho.env',        'database', 2),
  ('hermes-primary', 'Hermes Primary', 'service', 'AI', 'http://127.0.0.1:18691/health',       'http',    '#', '/opt/cortexos/.secrets/hermes/primary.env', 'brain',    3),
  ('hermes-secondary', 'Hermes Secondary', 'service', 'AI', 'http://127.0.0.1:18692/health',       'http',    '#', '/opt/cortexos/.secrets/hermes/secondary.env', 'brain',    4),
  ('ollama',         'Ollama',         'service', 'AI', 'ollama.service',                       'systemd', '#', NULL,                                      'ollama',   5),
  ('ollama-honcho-embeddings-proxy', 'Ollama Honcho Embeddings Proxy', 'service', 'AI', 'ollama-honcho-embeddings-proxy.service', 'systemd', '#', NULL, 'ollama', 6),
  ('paperclip',      'Paperclip',      'app',     'AI', 'http://127.0.0.1:3033/api/health',    'http',    '#', '/opt/cortexos/.secrets/paperclip.env',      'cloud',    7),
  ('kernel-browser', 'Kernel Browser', 'docker',  'AI', 'http://127.0.0.1:9222/json/version',  'http',    '#', '/opt/cortexos/.secrets/kernel-browser.env', 'browser',  8)
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
  ('floci',      'Floci',      'docker',  'Infrastructure', 'http://127.0.0.1:4566/_localstack/health', 'http',    '#', '/opt/cortexos/stacks/floci/.env',  'cloud',   2),
  ('cockpit',    'Cockpit',    'service', 'Infrastructure', 'tcp://127.0.0.1:9091',                     'tcp',     '#', NULL,                             'server',  3),
  ('webmin',     'Webmin',     'service', 'Infrastructure', 'tcp://127.0.0.1:10000',                    'tcp',     '#', NULL,                             'server',  4),
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
  ('postgresql', 'PostgreSQL', 'docker',  'Database', 'tcp://127.0.0.1:5432',          'tcp',  '#', '/opt/cortexos/.secrets/postgres.env', 'postgresql', 1),
  ('redis',      'Redis',      'docker',  'Database', 'tcp://127.0.0.1:6379',          'tcp',  '#', '/opt/cortexos/.secrets/redis.env',    'redis',      2),
  ('mongodb',    'MongoDB',    'docker',  'Database', 'tcp://127.0.0.1:27017',         'tcp',  '#', '/opt/cortexos/.secrets/mongodb.env',  'database',   3)
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
  ('home-assistant', 'Home Assistant', 'docker', 'Home', 'http://127.0.0.1:8123', 'http', '#', '/opt/cortexos/stacks/home-assistant/.env', 'home', 1)
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
  ('jellyfin', 'Jellyfin', 'docker', 'Media', 'http://127.0.0.1:8096/health', 'http', '#', '/opt/cortexos/stacks/jellyfin/.env', 'jellyfin', 1)
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
  ('otel-collector', 'OTel Collector', 'docker',  'Monitoring', 'tcp://127.0.0.1:4317',             'tcp',     '#', '/opt/cortexos/stacks/otel/.env',           'monitor', 9),
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
  ('cortex-dashboard', 'Cortex Dashboard', 'service', 'Infrastructure', 'http://127.0.0.1:3080/en/login', 'http', '#', '/opt/cortexos/.secrets/dashboard.env', 'server', 9)
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

-- WebUI flags are an explicit app-launcher allowlist, not inferred from any
-- URL. API routes and health endpoints must stay out of Apps.
UPDATE services
SET has_webui = slug IN (
    '9router',
    'hermes-dashboard',
    'paperclip',
    'pgadmin',
    'redisinsight',
    'mongo-express',
    'phpmyadmin',
    'home-assistant',
    'jellyfin',
    'cockpit',
    'webmin',
    'dockhand',
    'grafana',
    'prometheus',
    'cadvisor',
    'langfuse'
  ) AND open_url <> '#',
    show_in_webui = is_active AND slug IN (
    '9router',
    'hermes-dashboard',
    'paperclip',
    'pgadmin',
    'redisinsight',
    'mongo-express',
    'phpmyadmin',
    'home-assistant',
    'jellyfin',
    'cockpit',
    'webmin',
    'dockhand',
    'grafana',
    'prometheus',
    'cadvisor',
    'langfuse'
  ) AND open_url <> '#';

-- ============================================================
-- service_badges: tag seeded services with catalog badges
-- ============================================================

-- AI category
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('9router','honcho','hermes-primary','hermes-secondary','ollama','ollama-honcho-embeddings-proxy','paperclip','kernel-browser')
  AND b.slug = 'ai'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('hermes-primary','hermes-secondary')
  AND b.slug = 'agent'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('9router','honcho','hermes-primary','hermes-secondary','paperclip')
  AND b.slug = 'api'
ON CONFLICT (service_id, badge_id) DO NOTHING;

-- Infrastructure
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('floci','cockpit','webmin','watchtower','tailscale','dnsmasq','fail2ban','cortex-dashboard')
  AND b.slug = 'infra'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('tailscale','dnsmasq')
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
WHERE s.slug IN ('postgresql','redis','mongodb')
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

-- Agent factory definitions are not seeded by the dashboard. Cortex Hermes is
-- the only actor allowed to create or mutate factories.

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
INSERT INTO migrations (name) VALUES ('002_seed')
ON CONFLICT (name) DO NOTHING;
