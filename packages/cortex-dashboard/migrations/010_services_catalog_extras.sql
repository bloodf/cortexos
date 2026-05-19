-- Extra catalog rows for tools exposed through Caddy that were missing from
-- 002_seed.sql. These rows are inserted with is_active = FALSE so they do not
-- show up in the dashboard until the dynamic-seed step (scripts/dynamic-seed.js)
-- confirms the backing spoke is installed (via .secrets/.setup-state.json,
-- env vars, or `docker ps`).
--
-- The dynamic-seed step UPSERTs by slug and toggles is_active / show_in_webui.
-- All upstream tools without a web UI are intentionally absent from this
-- migration (OpenClaw gateway, AgentGateway, 9Router, OpenViking, LEANN,
-- kernel-browser, cortex-graph, cortex-sandbox-runner, fluent-bit, paperclip
-- bridge — see prompts/tools/40-openclaw.md, 50-agentgateway.md, etc.).

-- Langfuse v3 (observability for LLM calls). Sub-path /langfuse/ via Caddy.
INSERT INTO services
  (slug, name, kind, category, health_url, health_type, open_url, env_source,
   icon_type, sort_order, is_active, has_webui, show_in_webui)
VALUES
  ('langfuse', 'Langfuse', 'docker', 'Monitoring',
   'http://127.0.0.1:3001/api/public/health', 'http', '#',
   '/opt/cortexos/.secrets/langfuse.env',
   'monitor', 20, FALSE, TRUE, FALSE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  category = EXCLUDED.category,
  health_url = EXCLUDED.health_url,
  health_type = EXCLUDED.health_type,
  env_source = EXCLUDED.env_source,
  icon_type = EXCLUDED.icon_type,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- NATS HTTP monitoring port (8222) — JSON status pages, useful for operators.
-- The docker-bridged HTTP is the only "UI" NATS exposes.
INSERT INTO services
  (slug, name, kind, category, health_url, health_type, open_url, env_source,
   icon_type, sort_order, is_active, has_webui, show_in_webui)
VALUES
  ('nats-monitor', 'NATS Monitor', 'docker', 'Monitoring',
   'http://127.0.0.1:8222/healthz', 'http', '#',
   '/opt/cortexos/.secrets/nats.env',
   'monitor', 21, FALSE, TRUE, FALSE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  category = EXCLUDED.category,
  health_url = EXCLUDED.health_url,
  health_type = EXCLUDED.health_type,
  env_source = EXCLUDED.env_source,
  icon_type = EXCLUDED.icon_type,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Badges for the new rows.
INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug IN ('langfuse','nats-monitor') AND b.slug = 'monitoring'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'langfuse' AND b.slug IN ('ai','app')
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO service_badges (service_id, badge_id)
SELECT s.id, b.id FROM services s, badges b
WHERE s.slug = 'nats-monitor' AND b.slug = 'infra'
ON CONFLICT (service_id, badge_id) DO NOTHING;

INSERT INTO migrations (name) VALUES ('010_services_catalog_extras')
ON CONFLICT (name) DO NOTHING;
