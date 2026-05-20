-- Rollback for 011_services_open_url_paths.
-- Restores the function body that shipped in migration 004.

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
  UPDATE services SET open_url = base_url || ':8020/'            WHERE slug = 'openviking';
  UPDATE services SET open_url = base_url || ':3000/'            WHERE slug = 'grafana';
  UPDATE services SET open_url = base_url || ':8096/'            WHERE slug = 'jellyfin';
  UPDATE services SET open_url = base_url || ':8123/'            WHERE slug = 'home-assistant';
  UPDATE services SET open_url = '#'                             WHERE slug IN ('dockhand','agentgateway','kernel-browser');

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

DELETE FROM migrations WHERE name = '011_services_open_url_paths';
