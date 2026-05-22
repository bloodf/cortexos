-- Runtime alignment for the all-in-one Hermes/Honcho/Paperclip installer.

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

  origin := regexp_replace(normalized, ':[0-9]+$', '');

  UPDATE services SET open_url = origin || '/' WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = origin || ':11434/dashboard' WHERE slug = '9router';
  UPDATE services SET open_url = origin || ':3000/' WHERE slug = 'grafana';
  UPDATE services SET open_url = origin || ':9090/' WHERE slug = 'prometheus';
  UPDATE services SET open_url = origin || ':3100/' WHERE slug = 'loki';
  UPDATE services SET open_url = origin || ':8081/' WHERE slug = 'cadvisor';
  UPDATE services SET open_url = origin || ':3001/' WHERE slug = 'langfuse';
  UPDATE services SET open_url = origin || ':18690/' WHERE slug = 'honcho';
  UPDATE services SET open_url = origin || ':18691/health' WHERE slug = 'hermes-primary';
  UPDATE services SET open_url = origin || ':18692/health' WHERE slug = 'hermes-secondary';
  UPDATE services SET open_url = origin || ':9119/' WHERE slug = 'hermes-dashboard';
  UPDATE services SET open_url = origin || ':5050/' WHERE slug = 'pgadmin';
  UPDATE services SET open_url = origin || ':5540/' WHERE slug = 'redisinsight';
  UPDATE services SET open_url = origin || ':8083/' WHERE slug = 'mongo-express';
  UPDATE services SET open_url = origin || ':8082/' WHERE slug = 'phpmyadmin';
  UPDATE services SET open_url = origin || ':3033/' WHERE slug = 'paperclip';
  UPDATE services SET open_url = origin || ':9091/' WHERE slug = 'cockpit';
  UPDATE services SET open_url = origin || ':3420/' WHERE slug = 'dockhand';
  UPDATE services SET open_url = origin || ':4566/_localstack/health' WHERE slug = 'floci';
  UPDATE services SET open_url = origin || ':8123/' WHERE slug = 'home-assistant';
  UPDATE services SET open_url = origin || ':8096/' WHERE slug = 'jellyfin';
  UPDATE services SET open_url = origin || ':10000/' WHERE slug = 'webmin';

  UPDATE services SET open_url = '#' WHERE slug IN (
    'kernel-browser','cortex-sandbox-runner','fluent-bit','promtail',
    'node-exporter','pg-exporter','redis-exporter','mongo-exporter',
    'otel-collector','postgresql','redis','mongodb','mysql','tailscale',
    'dnsmasq','fail2ban','ollama','ollama-honcho-embeddings-proxy'
  );

  UPDATE services
     SET has_webui = open_url <> '#',
         show_in_webui = is_active AND open_url <> '#',
         updated_at = NOW();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

INSERT INTO migrations (name) VALUES ('003_runtime_alignment')
ON CONFLICT (name) DO NOTHING;
