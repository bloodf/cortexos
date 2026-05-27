-- Keep Apps limited to real browser UIs. API endpoints and health/metrics
-- routes may still be healthchecked, but they are not launcher apps.
CREATE OR REPLACE FUNCTION cortex_set_service_urls(base_url TEXT)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  normalized TEXT := regexp_replace(base_url, '/+$', '');
  origin TEXT;
  affected integer := 0;
  webui_slugs TEXT[] := ARRAY[
    '9router',
    'hermes-dashboard',
    'paperclip',
    'pgadmin',
    'redisinsight',
    'mongo-express',
    'phpmyadmin',
    'home-assistant',
    'jellyfin',
    'cockpit',
    'webmin',
    'dockhand',
    'grafana',
    'prometheus',
    'cadvisor',
    'langfuse'
  ];
BEGIN
  IF normalized IS NULL OR length(trim(normalized)) = 0 THEN
    RAISE EXCEPTION 'cortex_set_service_urls: base_url is required';
  END IF;

  origin := regexp_replace(normalized, ':[0-9]+$', '');

  UPDATE services SET open_url = '#' WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = origin || ':11434/dashboard' WHERE slug = '9router';
  UPDATE services SET open_url = origin || ':3000/' WHERE slug = 'grafana';
  UPDATE services SET open_url = origin || ':9090/' WHERE slug = 'prometheus';
  UPDATE services SET open_url = '#' WHERE slug = 'loki';
  UPDATE services SET open_url = origin || ':8081/' WHERE slug = 'cadvisor';
  UPDATE services SET open_url = origin || ':3001/' WHERE slug = 'langfuse';
  UPDATE services SET open_url = '#' WHERE slug = 'honcho';
  UPDATE services SET open_url = '#' WHERE slug = 'hermes-primary';
  UPDATE services SET open_url = '#' WHERE slug = 'hermes-secondary';
  UPDATE services SET open_url = origin || ':5050/' WHERE slug = 'pgadmin';
  UPDATE services SET open_url = origin || ':5540/' WHERE slug = 'redisinsight';
  UPDATE services SET open_url = origin || ':8083/' WHERE slug = 'mongo-express';
  UPDATE services SET open_url = origin || ':8082/' WHERE slug = 'phpmyadmin';
  UPDATE services SET open_url = origin || ':3033/' WHERE slug = 'paperclip';
  UPDATE services SET open_url = origin || ':9091/' WHERE slug = 'cockpit';
  UPDATE services SET open_url = origin || ':3420/' WHERE slug = 'dockhand';
  UPDATE services SET open_url = '#' WHERE slug = 'floci';
  UPDATE services SET open_url = origin || ':8123/' WHERE slug = 'home-assistant';
  UPDATE services SET open_url = origin || ':8096/' WHERE slug = 'jellyfin';
  UPDATE services SET open_url = origin || ':10000/' WHERE slug = 'webmin';

  UPDATE services SET open_url = '#' WHERE slug IN (
    'kernel-browser','cortex-sandbox-runner','fluent-bit','promtail',
    'node-exporter','pg-exporter','redis-exporter','mongo-exporter',
    'otel-collector','postgresql','redis','mongodb','mysql','tailscale',
    'dnsmasq','fail2ban','ollama','ollama-honcho-embeddings-proxy',
    'cortex-mail-guardian'
  );

  UPDATE services
     SET has_webui = slug = ANY(webui_slugs) AND open_url <> '#',
         show_in_webui = is_active AND slug = ANY(webui_slugs) AND open_url <> '#',
         updated_at = NOW();

  UPDATE services
     SET has_webui = false,
         show_in_webui = false,
         updated_at = NOW()
   WHERE slug = 'cortex-dashboard';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

UPDATE services
   SET open_url = '#',
       has_webui = false,
       show_in_webui = false,
       updated_at = NOW()
 WHERE slug IN (
   'honcho',
   'hermes-primary',
   'hermes-secondary',
   'floci',
   'loki',
   'cortex-dashboard'
 );

UPDATE services
   SET has_webui = slug IN (
       '9router',
       'hermes-dashboard',
       'paperclip',
       'pgadmin',
       'redisinsight',
       'mongo-express',
       'phpmyadmin',
       'home-assistant',
       'jellyfin',
       'cockpit',
       'webmin',
       'dockhand',
       'grafana',
       'prometheus',
       'cadvisor',
       'langfuse'
     ) AND open_url <> '#',
       show_in_webui = is_active AND slug IN (
       '9router',
       'hermes-dashboard',
       'paperclip',
       'pgadmin',
       'redisinsight',
       'mongo-express',
       'phpmyadmin',
       'home-assistant',
       'jellyfin',
       'cockpit',
       'webmin',
       'dockhand',
       'grafana',
       'prometheus',
       'cadvisor',
       'langfuse'
     ) AND open_url <> '#',
       updated_at = NOW();

INSERT INTO migrations (name) VALUES ('014_webui_app_registry_source')
ON CONFLICT (name) DO NOTHING;
