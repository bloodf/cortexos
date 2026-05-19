-- 014_dynamic_service_visibility.rollback.sql
-- Restore the 011 helper shape. Data touched by dynamic-seed is intentionally
-- not rolled back; service visibility is derived from install state on restart.

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

  UPDATE services SET open_url = '#' WHERE slug IN (
    '9router','openviking','openclaw','agentgateway','kernel-browser','leann'
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

DELETE FROM migrations WHERE name = '014_dynamic_service_visibility';
