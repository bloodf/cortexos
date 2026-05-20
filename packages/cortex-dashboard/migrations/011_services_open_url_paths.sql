-- Extend cortex_set_service_urls(base_url) with every tool that has a web UI
-- exposed by Tailscale Serve. Keeps 004's contract (idempotent UPSERT of
-- open_url by slug) and assigns each UI to its own tailnet port.
--
-- Slugs absent from this list either have no web UI (OpenClaw, AgentGateway,
-- OpenViking, LEANN, kernel-browser, cortex-graph, cortex-sandbox-runner,
-- fluent-bit, paperclip bridge) or are already wired by 004
-- (cortex-dashboard, grafana, jellyfin, home-assistant, dockhand).
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

  UPDATE services SET open_url = base_url || '/'                 WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = base_url || ':11434/dashboard'  WHERE slug = '9router';
  UPDATE services SET open_url = base_url || ':3000/'            WHERE slug = 'grafana';
  UPDATE services SET open_url = base_url || ':9090/'            WHERE slug = 'prometheus';
  UPDATE services SET open_url = base_url || ':3100/'            WHERE slug = 'loki';
  UPDATE services SET open_url = base_url || ':8081/'            WHERE slug = 'cadvisor';
  UPDATE services SET open_url = base_url || ':3001/'            WHERE slug = 'langfuse';
  UPDATE services SET open_url = base_url || ':8222/'            WHERE slug = 'nats-monitor';
  UPDATE services SET open_url = base_url || ':8096/'            WHERE slug = 'jellyfin';
  UPDATE services SET open_url = base_url || ':8123/'            WHERE slug = 'home-assistant';

  -- Backend-only services: keep open_url pinned to '#'. Listed explicitly so
  -- prior runs against a stale base get cleaned up.
  UPDATE services SET open_url = '#' WHERE slug IN (
    'dockhand','openviking','openclaw','agentgateway','kernel-browser','leann'
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

INSERT INTO migrations (name) VALUES ('011_services_open_url_paths')
ON CONFLICT (name) DO NOTHING;
