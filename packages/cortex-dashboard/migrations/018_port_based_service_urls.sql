-- Switch service catalog URLs from shared path routing to Tailscale
-- Serve port routing. Dashboard remains on HTTPS 443 at the origin root;
-- each other Web UI/API uses its native local port over the tailnet.

DROP FUNCTION IF EXISTS cortex_set_service_urls(TEXT);

CREATE OR REPLACE FUNCTION cortex_set_service_urls(base_url TEXT)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  normalized TEXT := regexp_replace(base_url, '/+$', '');
  origin TEXT;
  affected integer := 0;
BEGIN
  IF normalized IS NULL OR length(trim(normalized)) = 0 THEN
    RAISE EXCEPTION 'cortex_set_service_urls: base_url is required';
  END IF;

  -- Drop an explicit port from the input base before appending service ports.
  origin := regexp_replace(normalized, ':[0-9]+$', '');

  UPDATE services SET open_url = origin || '/' WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = origin || ':11434/dashboard' WHERE slug = '9router';
  UPDATE services SET open_url = origin || ':3000/' WHERE slug = 'grafana';
  UPDATE services SET open_url = origin || ':9090/' WHERE slug = 'prometheus';
  UPDATE services SET open_url = origin || ':3100/' WHERE slug = 'loki';
  UPDATE services SET open_url = origin || ':8081/' WHERE slug = 'cadvisor';
  UPDATE services SET open_url = origin || ':8222/' WHERE slug = 'nats-monitor';
  UPDATE services SET open_url = origin || ':3001/' WHERE slug = 'langfuse';
  UPDATE services SET open_url = origin || ':8020/' WHERE slug = 'openviking';
  UPDATE services SET open_url = origin || ':18789/' WHERE slug = 'openclaw';
  UPDATE services SET open_url = origin || ':18791/' WHERE slug = 'leann';
  UPDATE services SET open_url = origin || ':8090/' WHERE slug = 'cortex-graph';
  UPDATE services SET open_url = origin || ':5050/' WHERE slug = 'pgadmin';
  UPDATE services SET open_url = origin || ':5540/' WHERE slug = 'redisinsight';
  UPDATE services SET open_url = origin || ':8083/' WHERE slug = 'mongo-express';
  UPDATE services SET open_url = origin || ':8082/' WHERE slug = 'phpmyadmin';

  UPDATE services SET open_url = '#' WHERE slug IN (
    'agentgateway','kernel-browser','cortex-sandbox-runner','cortex-consumer',
    'fluent-bit','promtail','node-exporter','pg-exporter','redis-exporter',
    'mongo-exporter','otel-collector','postgresql','redis','mongodb','mysql',
    'nats','caddy','tailscale','dnsmasq','fail2ban','dockhand',
    'home-assistant','jellyfin','paperclip-bridge'
  );

  UPDATE services
     SET has_webui = open_url <> '#',
         show_in_webui = is_active AND open_url <> '#',
         updated_at = NOW();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

INSERT INTO migrations (name) VALUES ('018_port_based_service_urls')
ON CONFLICT (name) DO NOTHING;
