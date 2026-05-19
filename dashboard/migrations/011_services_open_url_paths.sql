-- Extend cortex_set_service_urls(base_url) with every tool that has a web UI
-- routed through Caddy. Keeps 004's contract (idempotent UPSERT of open_url
-- by slug) but adds the routes added in prompts/tools/13-caddy.md:
--   /prometheus, /loki, /cadvisor, /langfuse, /nats
--
-- Slugs absent from this list either have no web UI (OpenClaw, AgentGateway,
-- 9Router, OpenViking, LEANN, kernel-browser, cortex-graph,
-- cortex-sandbox-runner, fluent-bit, paperclip bridge) or are already wired
-- by 004 (cortex-dashboard, grafana, jellyfin, home-assistant, dockhand).
--
-- Re-running this migration overwrites previous open_url values — safe by
-- design.

CREATE OR REPLACE FUNCTION cortex_set_service_urls(base_url text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  affected integer := 0;
BEGIN
  IF base_url IS NULL OR length(trim(base_url)) = 0 THEN
    RAISE EXCEPTION 'cortex_set_service_urls: base_url is required';
  END IF;

  base_url := regexp_replace(base_url, '/+$', '');

  UPDATE services SET open_url = base_url                        WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = base_url || '/dockhand'         WHERE slug = 'dockhand';
  UPDATE services SET open_url = base_url || '/grafana/'         WHERE slug = 'grafana';
  UPDATE services SET open_url = base_url || '/prometheus/'      WHERE slug = 'prometheus';
  UPDATE services SET open_url = base_url || '/loki/'            WHERE slug = 'loki';
  UPDATE services SET open_url = base_url || '/cadvisor/'        WHERE slug = 'cadvisor';
  UPDATE services SET open_url = base_url || '/langfuse/'        WHERE slug = 'langfuse';
  UPDATE services SET open_url = base_url || '/nats/'            WHERE slug = 'nats-monitor';
  UPDATE services SET open_url = base_url || '/jellyfin'         WHERE slug = 'jellyfin';
  UPDATE services SET open_url = base_url || '/ha'               WHERE slug = 'home-assistant';

  -- Backend-only services: keep open_url pinned to '#'. Listed explicitly so
  -- prior runs against a stale base get cleaned up.
  UPDATE services SET open_url = '#' WHERE slug IN (
    '9router','openviking','openclaw','agentgateway','kernel-browser','leann'
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

INSERT INTO migrations (name) VALUES ('011_services_open_url_paths')
ON CONFLICT (name) DO NOTHING;
