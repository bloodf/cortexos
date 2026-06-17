-- Migration 019: Track + extend cortex_set_service_urls(base_url).
--
-- cortex_set_service_urls is the project's per-install URL mechanism: given the
-- install's public base URL (e.g. the tailnet host), it sets each web-UI
-- service's open_url to base + ':PORT'. The host is a RUNTIME ARGUMENT, so no
-- per-install hostname is ever committed to the repo.
--
-- This proc previously lived only in the live DB (untracked) and was invoked
-- only by scripts/dynamic-seed.js (host-only, dropped — see
-- docs/internal/research/cortexos-audit-2026-06-05.md). This migration commits
-- it so it is reproducible, and extends it to cover Honcho (Swagger /docs) and
-- 9Remote so they appear on /apps once a base URL is applied. Apply per host:
--
--   SELECT cortex_set_service_urls('https://<your-tailnet-host>');
--
-- Idempotent: CREATE OR REPLACE; re-running the SELECT sets the same values.

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
  -- Extract scheme+host (strip port and path) for per-service port URLs.
  base := regexp_replace(base_url, '(https?://[^:/]+).*', '\1');
  -- http variant for services that serve plain http (e.g. 9remote binds
  -- 0.0.0.0 and cannot be tailscale-served / TLS-terminated on its own port).
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
  -- Local web UIs previously hardcoded in migration 012 (now host-agnostic).
  UPDATE services SET open_url = base || ':8200/'               WHERE slug = 'boxbox-host';
  UPDATE services SET open_url = base || ':18787/'              WHERE slug = 'hermes-webui-host';
  UPDATE services SET open_url = base || ':9119/'               WHERE slug = 'hermes-dashboard';
  UPDATE services SET open_url = base || ':6333/'               WHERE slug = 'memory-os-host';

  -- Honcho: REST API surfaced over the tailnet via `tailscale serve` (TLS);
  -- link to its Swagger docs. 9Remote: plain http on :2208 (see base_http).
  -- These also flip the webui flags so /apps shows them without depending on
  -- the (dropped) dynamic-seed flag pass.
  UPDATE services SET open_url = base || ':18690/docs',
                      has_webui = true, show_in_webui = true   WHERE slug = 'honcho';
  UPDATE services SET open_url = base_http || ':2208/',
                      has_webui = true, show_in_webui = true   WHERE slug = '9remote';

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
