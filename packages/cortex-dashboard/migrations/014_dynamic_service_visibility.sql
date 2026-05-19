-- 014_dynamic_service_visibility.sql
-- Keep the services catalog in sync with installed spokes after the dashboard
-- container starts. Earlier installs may have applied 011 before /9router was
-- routed and before dynamic-seed updated web UI flags, so recreate the helper
-- and let scripts/dynamic-seed.js invoke it with the install's public base URL.

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
  UPDATE services SET open_url = base_url || '/langfuse/'        WHERE slug = 'langfuse';
  UPDATE services SET open_url = base_url || '/nats/'            WHERE slug = 'nats-monitor';
  UPDATE services SET open_url = base_url || '/jellyfin'         WHERE slug = 'jellyfin';
  UPDATE services SET open_url = base_url || '/ha'               WHERE slug = 'home-assistant';

  UPDATE services SET open_url = '#' WHERE slug IN (
    'openviking','openclaw','agentgateway','kernel-browser','leann',
    'cortex-graph','cortex-sandbox-runner','cortex-consumer','fluent-bit',
    'promtail','node-exporter','pg-exporter','redis-exporter','mongo-exporter',
    'otel-collector','postgresql','redis','mongodb','nats','caddy','tailscale',
    'dnsmasq','fail2ban'
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

INSERT INTO migrations (name) VALUES ('014_dynamic_service_visibility')
ON CONFLICT (name) DO NOTHING;
