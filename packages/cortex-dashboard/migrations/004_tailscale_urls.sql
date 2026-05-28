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

  UPDATE services SET open_url = base_url                        WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = base_url || '/9router/'        WHERE slug = '9router';
  UPDATE services SET open_url = base_url || '/dockhand'         WHERE slug = 'dockhand';
  UPDATE services SET open_url = base_url || '/grafana/'         WHERE slug = 'grafana';
  UPDATE services SET open_url = base_url || '/prometheus/'      WHERE slug = 'prometheus';
  UPDATE services SET open_url = base_url || '/loki/'            WHERE slug = 'loki';
  UPDATE services SET open_url = base_url || '/cadvisor/'        WHERE slug = 'cadvisor';
  UPDATE services SET open_url = base_url || '/jellyfin'         WHERE slug = 'jellyfin';
  UPDATE services SET open_url = base_url || '/ha'               WHERE slug = 'home-assistant';
  UPDATE services SET open_url = base_url || '/cockpit/'         WHERE slug = 'cockpit';
  UPDATE services SET open_url = base_url || '/webmin/'          WHERE slug = 'webmin';
  UPDATE services SET open_url = base_url || '/pgadmin/'         WHERE slug = 'pgadmin';
  UPDATE services SET open_url = base_url || '/phpmyadmin/'      WHERE slug = 'phpmyadmin';
  UPDATE services SET open_url = base_url || '/redisinsight/'    WHERE slug = 'redisinsight';
  UPDATE services SET open_url = base_url || '/mongo-express/'   WHERE slug = 'mongo-express';
  UPDATE services SET open_url = base_url || '/minio/'           WHERE slug = 'minio';
  UPDATE services SET open_url = base_url || '/rabbitmq/'        WHERE slug = 'rabbitmq';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
