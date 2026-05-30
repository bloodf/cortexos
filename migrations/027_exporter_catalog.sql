-- Add missing exporter catalog rows for snmp-exporter and adguard-exporter.
-- These services are part of the monitoring stack but were never seeded.
-- They are referenced in dynamic-seed.js SPOKE_TO_SERVICES under "28-db-exporters".
-- Both default to inactive; operators activate via the dashboard after confirming
-- the monitoring stack is deployed.

INSERT INTO services
  (slug, name, kind, category, health_url, health_type, open_url, env_source, icon_type, sort_order)
VALUES
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

UPDATE services SET has_webui = false, show_in_webui = false WHERE slug IN ('snmp-exporter', 'adguard-exporter');

-- Bind to monitoring badge
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('snmp-exporter', 'adguard-exporter') AND b.slug = 'monitoring'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO migrations (name) VALUES ('027_exporter_catalog')
ON CONFLICT (name) DO NOTHING;
