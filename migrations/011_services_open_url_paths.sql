-- Recreate cortex_set_service_urls(base_url) for the rebuild catalog.

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
  UPDATE services SET open_url = base_url || '/obot/'            WHERE slug = 'obot';

  UPDATE services SET open_url = '#' WHERE slug IN (
    'ollama','honcho','honcho-mcp','ollama-honcho-embeddings-proxy',
    'obot','kernel-browser','cortex-sandbox-runner',
    'postgresql','mysql','redis','mongodb','caddy','tailscale','incus',
    'cortex-dashboard-root-helper','watchtower','dnsmasq','fail2ban',
    'node-exporter','fluent-bit','promtail','otel-collector',
    'pg-exporter','mysql-exporter','redis-exporter','mongo-exporter'
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

INSERT INTO migrations (name) VALUES ('011_services_open_url_paths')
ON CONFLICT (name) DO NOTHING;
