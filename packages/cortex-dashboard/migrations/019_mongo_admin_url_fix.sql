-- Fix mongo-express open_url: live Caddy route is /mongo-admin, not /mongo-express/.
-- Copies cortex_set_service_urls() verbatim from 014_dynamic_service_visibility.sql
-- changing ONLY the mongo-express open_url path.

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
  UPDATE services SET open_url = base_url || '/mongo-admin'      WHERE slug = 'mongo-express';
  UPDATE services SET open_url = base_url || '/minio/'           WHERE slug = 'minio';
  UPDATE services SET open_url = base_url || '/rabbitmq/'        WHERE slug = 'rabbitmq';

  UPDATE services SET open_url = '#' WHERE slug IN (
    'ollama','honcho','honcho-mcp','ollama-honcho-embeddings-proxy',
    'agentgateway','kernel-browser','cortex-sandbox-runner',
    'postgresql','mysql','redis','mongodb','caddy','tailscale','incus',
    'cortex-dashboard-root-helper','watchtower','dnsmasq','fail2ban',
    'node-exporter','fluent-bit','promtail','otel-collector',
    'pg-exporter','mysql-exporter','redis-exporter','mongo-exporter'
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

INSERT INTO migrations (name) VALUES ('019_mongo_admin_url_fix')
ON CONFLICT (name) DO NOTHING;
