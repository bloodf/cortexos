INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order, has_webui, show_in_webui)
VALUES ('hermes-dashboard', 'Hermes Web UI', 'service', 'AI', 'http://127.0.0.1:9119/', 'http', '#', NULL, 'brain', 5, true, true)
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
  has_webui = EXCLUDED.has_webui,
  show_in_webui = EXCLUDED.show_in_webui,
  updated_at = NOW();

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id
FROM services s, badges b
WHERE s.slug = 'hermes-dashboard'
  AND b.slug IN ('ai', 'agent', 'api')
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO migrations (name) VALUES ('009_hermes_dashboard_service')
ON CONFLICT (name) DO NOTHING;
