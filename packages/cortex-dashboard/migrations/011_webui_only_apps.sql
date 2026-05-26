-- Apps page is for real browser UIs only. API endpoints, health endpoints,
-- metrics endpoints, and process/service-only targets stay in health/services.
UPDATE services
SET open_url = '#',
    has_webui = false,
    show_in_webui = false,
    updated_at = NOW()
WHERE slug IN (
  'honcho',
  'hermes-primary',
  'hermes-secondary',
  'floci',
  'prometheus',
  'loki',
  'cadvisor'
);

UPDATE services
SET has_webui = true,
    show_in_webui = true,
    updated_at = NOW()
WHERE slug IN (
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
  'langfuse'
)
  AND open_url <> '#';

INSERT INTO migrations (name) VALUES ('011_webui_only_apps')
ON CONFLICT (name) DO NOTHING;
