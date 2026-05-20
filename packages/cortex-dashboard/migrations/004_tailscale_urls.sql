-- Public URL resolver.
--
-- After install, services seeded by 002_seed.sql have open_url = '#'. This migration
-- defines a helper function the provisioner (or the dashboard admin UI)
-- calls to bulk-assign service URLs against the chosen public base.
--
-- Example invocation (run by `provision-vps.sh` / dashboard admin UI once
-- CORTEX_DOMAIN is known):
--   SELECT cortex_set_service_urls('https://cortex.example.ts.net');
--
-- Idempotent: rerunning rewrites all matched URLs to the new base.

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

  -- Trim trailing slash for predictable joins.
  base_url := regexp_replace(base_url, '/+$', '');

  -- Slugs must match those seeded in 002_seed.sql. Retired services
  -- (openviking-ui, hindsight, hindsight-ui, agentgateway-mcp) are intentionally
  -- omitted — they no longer ship. Dashboard's own slug is 'cortex-dashboard'.
  UPDATE services SET open_url = base_url || '/'                 WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = base_url || ':11434/dashboard'  WHERE slug = '9router';
  UPDATE services SET open_url = base_url || ':8020/'            WHERE slug = 'openviking';
  UPDATE services SET open_url = base_url || ':3000/'            WHERE slug = 'grafana';
  UPDATE services SET open_url = base_url || ':8096/'            WHERE slug = 'jellyfin';
  UPDATE services SET open_url = base_url || ':8123/'            WHERE slug = 'home-assistant';
  UPDATE services SET open_url = '#'                             WHERE slug IN ('dockhand','agentgateway','kernel-browser');

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
