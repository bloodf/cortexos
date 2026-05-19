-- 013_backend_services.sql
-- Catalog rows for backend-only CortexOS spokes that ship without a web UI.
-- Codex readiness review flagged that scripts/dynamic-seed.js flips
-- `is_active` on rows that never existed, because 002_seed.sql + 010_extras
-- skip these intentionally. Add them with is_active = FALSE so the dynamic
-- seed has something to update once the spoke is installed.
--
-- Idempotent: INSERT ... ON CONFLICT (slug) DO NOTHING. No badge changes
-- beyond the explicit `infra` tag below — keeps re-runs deterministic.

INSERT INTO services
  (slug, name, kind, category, health_url, health_type, open_url, env_source,
   icon_type, sort_order, is_active, has_webui, show_in_webui)
VALUES
  ('cortex-graph', 'Cortex Graph', 'docker', 'AI',
   'http://127.0.0.1:8090/healthz', 'http', '#',
   '/opt/cortexos/.secrets/graph.env',
   'cloud', 30, FALSE, FALSE, FALSE),
  ('cortex-sandbox-runner', 'Cortex Sandbox Runner', 'docker', 'AI',
   'http://127.0.0.1:8091/healthz', 'http', '#',
   '/opt/cortexos/.secrets/sandbox.env',
   'cloud', 31, FALSE, FALSE, FALSE),
  ('cortex-consumer', 'Cortex Consumer', 'service', 'AI',
   'cortex-consumer', 'process', '#',
   '/opt/cortexos/.secrets/consumer.env',
   'server', 32, FALSE, FALSE, FALSE)
ON CONFLICT (slug) DO NOTHING;

-- Badges. AI tag for all three (mirrors 002_seed.sql AI grouping);
-- infra tag for cortex-consumer to signal it's a systemd-managed daemon.
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('cortex-graph', 'cortex-sandbox-runner', 'cortex-consumer')
  AND b.slug = 'ai'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'cortex-consumer' AND b.slug = 'infra'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO migrations (name) VALUES ('013_backend_services')
ON CONFLICT (name) DO NOTHING;
