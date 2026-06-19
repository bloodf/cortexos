-- Migration 021: Seed Hindsight service-catalog rows + extend
-- cortex_set_service_urls.
--
-- Hindsight is the primary memory backend (32b-hindsight.md). The Honcho
-- stack (017 / 019) is left deployed read-only — Honcho's slug keeps
-- is_active=true but its description is relabelled "legacy, read-only after
-- Hindsight migration". No honcho-* row is removed.
--
-- Host-agnostic by design: same pattern as 017. health_url is loopback;
-- open_url is set per install by cortex_set_service_urls(base_url).

INSERT INTO services (
  slug, name, kind, category, description,
  health_url, health_type, open_url,
  is_active, show_in_healthcheck, has_webui, show_in_webui
) VALUES
  (
    'hindsight', 'Hindsight', 'service', 'AI',
    'Self-hosted Hindsight memory backend (REST API on :8888). ' ||
    'See prompts/tools/32b-hindsight.md.',
    'http://127.0.0.1:8888/health', 'http', '#',
    true, true, false, false
  ),
  (
    'hindsight-control-plane', 'Hindsight Control Plane', 'service', 'AI',
    'Hindsight control-plane UI on :9999 (gVisor-friendly admin surface).',
    'http://127.0.0.1:9999', 'http', '#',
    true, true, false, false
  )
ON CONFLICT (slug) DO UPDATE SET
  health_url          = EXCLUDED.health_url,
  health_type         = EXCLUDED.health_type,
  is_active           = EXCLUDED.is_active,
  show_in_healthcheck = EXCLUDED.show_in_healthcheck,
  updated_at          = NOW();

-- Honcho relabel: idempotent (assign full literal, do not concatenate).
UPDATE services SET description = 'Self-hosted Honcho memory backend (REST API; Swagger at /docs). See prompts/tools/32-honcho.md. (legacy, read-only after Hindsight migration)' WHERE slug = 'honcho';

-- Replace cortex_set_service_urls so Hindsight open_urls are assigned too.
-- (019's body is preserved verbatim; two new lines added before the final '#'
-- block. Honcho behaviour unchanged.)
CREATE OR REPLACE FUNCTION public.cortex_set_service_urls(base_url text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  affected integer := 0;
  base text;
  base_http text;
BEGIN
  IF base_url IS NULL OR length(trim(base_url)) = 0 THEN
    RAISE EXCEPTION 'cortex_set_service_urls: base_url is required';
  END IF;
  base := regexp_replace(base_url, '(https?://[^:/]+).*', '\1');
  base_http := regexp_replace(base, '^https://', 'http://');

  UPDATE services SET open_url = base_url                       WHERE slug = 'cortex-dashboard';
  UPDATE services SET open_url = base || ':11434/'              WHERE slug = '9router';
  UPDATE services SET open_url = base || ':3420'                WHERE slug = 'dockhand';
  UPDATE services SET open_url = base || ':3000/'               WHERE slug = 'grafana';
  UPDATE services SET open_url = base || ':9090/'               WHERE slug = 'prometheus';
  UPDATE services SET open_url = base || ':3100/'               WHERE slug = 'loki';
  UPDATE services SET open_url = base || ':8081/'               WHERE slug = 'cadvisor';
  UPDATE services SET open_url = base || ':8096'                WHERE slug = 'jellyfin';
  UPDATE services SET open_url = base || ':8123'                WHERE slug = 'home-assistant';
  UPDATE services SET open_url = base || ':9091/'               WHERE slug = 'cockpit';
  UPDATE services SET open_url = base || ':10000/'              WHERE slug = 'webmin';
  UPDATE services SET open_url = base || ':5050/'               WHERE slug = 'pgadmin';
  UPDATE services SET open_url = base || ':8082/'               WHERE slug = 'phpmyadmin';
  UPDATE services SET open_url = base || ':5540/'               WHERE slug = 'redisinsight';
  UPDATE services SET open_url = base || ':8083'                WHERE slug = 'mongo-express';
  UPDATE services SET open_url = base || ':8090/'               WHERE slug = 'obot';
  UPDATE services SET open_url = base || ':8200/'               WHERE slug = 'boxbox-host';
  UPDATE services SET open_url = base || ':18787/'              WHERE slug = 'hermes-webui-host';
  UPDATE services SET open_url = base || ':9119/'               WHERE slug = 'hermes-dashboard';
  UPDATE services SET open_url = base || ':6333/'               WHERE slug = 'memory-os-host';

  -- Honcho: REST API surfaced over the tailnet via `tailscale serve` (TLS);
  -- link to its Swagger docs. 9Remote: plain http on :2208 (see base_http).
  UPDATE services SET open_url = base || ':18690/docs',
                      has_webui = true, show_in_webui = true   WHERE slug = 'honcho';
  UPDATE services SET open_url = base_http || ':2208/',
                      has_webui = true, show_in_webui = true   WHERE slug = '9remote';

  -- Hindsight (primary): REST API on :8888 + control-plane UI on :9999.
  UPDATE services SET open_url = base || ':8888/docs',
                      has_webui = true, show_in_webui = true   WHERE slug = 'hindsight';
  UPDATE services SET open_url = base || ':9999/',
                      has_webui = true, show_in_webui = true   WHERE slug = 'hindsight-control-plane';

  UPDATE services SET open_url = '#' WHERE slug IN (
    'ollama','honcho-mcp','ollama-honcho-embeddings-proxy',
    'kernel-browser','cortex-sandbox-runner',
    'postgresql','mysql','redis','mongodb','caddy','tailscale','incus',
    'cortex-dashboard-root-helper','watchtower','dnsmasq','fail2ban',
    'node-exporter','fluent-bit','promtail','otel-collector',
    'pg-exporter','mysql-exporter','redis-exporter','mongo-exporter',
    'cortex-mail-guardian','snmp-exporter','adguard-exporter'
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$function$;
