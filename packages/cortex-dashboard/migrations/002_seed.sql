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
  ('9router',        '9Router',        'service', 'AI', 'http://localhost:11434/v1/models',    'http',    '#', '/opt/cortexos/.secrets/9router.env',       'cloud',    1),
  ('honcho',         'Honcho',         'docker',  'AI', 'http://localhost:18690/health',       'http',    '#', '/opt/cortexos/.secrets/honcho.env',        'database', 2),
  ('hermes-primary', 'Hermes Primary', 'service', 'AI', 'http://localhost:18691/health',       'http',    '#', '/opt/cortexos/.secrets/hermes/primary.env', 'brain',    3),
  ('hermes-secondary', 'Hermes Secondary', 'service', 'AI', 'http://localhost:18692/health',       'http',    '#', '/opt/cortexos/.secrets/hermes/secondary.env', 'brain',    4),
  ('hermes-dashboard', 'Hermes Web UI', 'service', 'AI', 'http://localhost:9119/', 'http', '#', NULL, 'brain', 5),
  ('ollama',         'Ollama',         'service', 'AI', 'ollama.service',                       'systemd', '#', NULL,                                      'ollama',   6),
  ('ollama-honcho-embeddings-proxy', 'Ollama Honcho Embeddings Proxy', 'service', 'AI', 'ollama-honcho-embeddings-proxy.service', 'systemd', '#', NULL, 'ollama', 7),
  ('paperclip',      'Paperclip',      'app',     'AI', 'http://localhost:3033/api/health',    'http',    '#', '/opt/cortexos/.secrets/paperclip.env',      'cloud',    8),
  ('kernel-browser', 'Kernel Browser', 'docker',  'AI', 'http://localhost:9222/json/version',  'http',    '#', '/opt/cortexos/.secrets/kernel-browser.env', 'browser',  9)
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
  ('floci',      'Floci',      'docker',  'Infrastructure', 'http://localhost:4566/_localstack/health', 'http',    '#', '/opt/cortexos/stacks/floci/.env',  'cloud',   2),
  ('cockpit',    'Cockpit',    'service', 'Infrastructure', 'tcp://localhost:9091',                     'tcp',     '#', NULL,                             'server',  3),
  ('webmin',     'Webmin',     'service', 'Infrastructure', 'tcp://localhost:10000',                    'tcp',     '#', NULL,                             'server',  4),
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
  ('postgresql', 'PostgreSQL', 'docker',  'Database', 'tcp://localhost:5432',          'tcp',  '#', '/opt/cortexos/.secrets/postgres.env', 'postgresql', 1),
  ('redis',      'Redis',      'docker',  'Database', 'tcp://localhost:6379',          'tcp',  '#', '/opt/cortexos/.secrets/redis.env',    'redis',      2),
  ('mongodb',    'MongoDB',    'docker',  'Database', 'tcp://localhost:27017',         'tcp',  '#', '/opt/cortexos/.secrets/mongodb.env',  'database',   3)
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
  ('home-assistant', 'Home Assistant', 'docker', 'Home', 'http://localhost:8123', 'http', '#', '/opt/cortexos/stacks/home-assistant/.env', 'home', 1)
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
  ('jellyfin', 'Jellyfin', 'docker', 'Media', 'http://localhost:8096/health', 'http', '#', '/opt/cortexos/stacks/jellyfin/.env', 'jellyfin', 1)
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
  ('dockhand',       'Dockhand',       'docker',  'Monitoring', 'http://localhost:3420',            'http',    '#', '/opt/cortexos/stacks/dockhand/.env',       'monitor', 1),
  ('grafana',        'Grafana',        'service', 'Monitoring', 'http://localhost:3000/api/health', 'http',    '#', '/opt/cortexos/stacks/grafana/.env',        'monitor', 2),
  ('prometheus',     'Prometheus',     'service', 'Monitoring', 'http://localhost:9090/-/healthy',  'http',    '#', '/opt/cortexos/stacks/prometheus/.env',     'monitor', 3),
  ('loki',           'Loki',           'service', 'Monitoring', 'http://localhost:3100/ready',      'http',    '#', '/opt/cortexos/stacks/loki/.env',           'monitor', 4),
  ('fluent-bit',     'Fluent Bit',     'service', 'Monitoring', 'fluent-bit',                                  'process',  '#', '/opt/cortexos/stacks/fluent-bit/.env',     'monitor', 5),
  ('promtail',       'Promtail',       'process', 'Monitoring', 'promtail',                                    'process', '#', NULL,                                     'monitor', 6),
  ('cadvisor',       'cAdvisor',       'docker',  'Monitoring', 'http://localhost:8081/metrics',    'http',    '#', NULL,                                     'monitor', 7),
  ('node-exporter',  'Node Exporter',  'service', 'Monitoring', 'http://localhost:9100/metrics',    'http',    '#', NULL,                                     'monitor', 8),
  ('otel-collector', 'OTel Collector', 'docker',  'Monitoring', 'tcp://localhost:4317',             'tcp',     '#', '/opt/cortexos/stacks/otel/.env',           'monitor', 9),
  ('pg-exporter',    'PG Exporter',    'docker',  'Monitoring', 'http://localhost:9187/metrics',    'http',    '#', '/opt/cortexos/stacks/pg-exporter/.env',    'monitor', 10),
  ('redis-exporter', 'Redis Exporter', 'docker',  'Monitoring', 'http://localhost:9121/metrics',    'http',    '#', '/opt/cortexos/stacks/redis-exporter/.env', 'monitor', 11),
  ('mongo-exporter', 'Mongo Exporter', 'docker',  'Monitoring', 'http://localhost:9216/metrics',    'http',    '#', '/opt/cortexos/stacks/mongo-exporter/.env', 'monitor', 12)
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
  ('cortex-dashboard', 'Cortex Dashboard', 'service', 'Infrastructure', 'http://localhost:3080/en/login', 'http', '#', '/opt/cortexos/.secrets/dashboard.env', 'server', 9)
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
WHERE s.slug IN ('9router','honcho','hermes-primary','hermes-secondary','hermes-dashboard','ollama','ollama-honcho-embeddings-proxy','paperclip','kernel-browser')
  AND b.slug = 'ai'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('hermes-primary','hermes-secondary','hermes-dashboard')
  AND b.slug = 'agent'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('9router','honcho','hermes-primary','hermes-secondary','hermes-dashboard','paperclip')
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

-- ============================================================
-- Current project/factory seeds. Secrets and personal channel tokens are never
-- stored here; runtime integration uses Paperclip, Hermes profiles, and Honcho.
-- ============================================================

-- Project/factory seeds are generic. Real projects are created through the
-- dashboard Projects page or installer configuration; do not seed private
-- project names in the public repo.

INSERT INTO agent_factories (slug, name, kind, schema_version, definition, created_by)
VALUES (
  'paperclip-project-template',
  'Paperclip Project Template',
  'project',
  3,
  '{
    "template":"templates/agent-factory/README.md",
    "markdownFile":"README.md",
    "apps":["paperclip","honcho","9router","cortex-dashboard","langfuse"],
    "paperclip":{
      "organization_kind":"project_team",
      "project_slug":"example-project",
      "seat_model":"position",
      "adapter":"hermes_local",
      "hermes_profile_pattern":"{project}",
      "honcho_workspace_pattern":"{project}",
      "required_positions":[
        {"seat":"pm","title":"Product Manager","paperclip_role":"PM","count":1},
        {"seat":"cto","title":"CTO","paperclip_role":"CTO","count":1},
        {"seat":"eng-backend","title":"Backend Engineer","paperclip_role":"ENG-BACKEND","count":1},
        {"seat":"eng-frontend","title":"Frontend Engineer","paperclip_role":"ENG-FRONTEND","count":1},
        {"seat":"qa","title":"QA Engineer","paperclip_role":"QA","count":1}
      ],
      "optional_positions":[
        {"seat":"ceo","title":"CEO","paperclip_role":"CEO","count":1},
        {"seat":"po","title":"Product Owner","paperclip_role":"PO","count":1},
        {"seat":"staff-eng","title":"Staff Engineer","paperclip_role":"STAFF-ENG","count":1},
        {"seat":"uxui","title":"UX/UI Designer","paperclip_role":"UXUI","count":1},
        {"seat":"eng-mobile","title":"Mobile Engineer","paperclip_role":"ENG-MOBILE","count":1},
        {"seat":"eng-esp32","title":"ESP32 Engineer","paperclip_role":"ENG-ESP32","count":1}
      ],
      "agent_slug_pattern":"{project}-{seat}",
      "ticket_link_table":"paperclip_ticket_link"
    }
  }'::jsonb,
  'system'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  schema_version = EXCLUDED.schema_version,
  definition = EXCLUDED.definition,
  updated_at = NOW();

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
