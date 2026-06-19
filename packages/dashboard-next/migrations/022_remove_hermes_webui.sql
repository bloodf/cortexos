-- Migration 022: Remove Hermes Web UI service row + drop from URL proc.
--
-- The Hermes Web UI (nesquena/hermes-webui, host service on :18787) is
-- retired. Its systemd unit, install prompt, env file, install dir, and
-- Tailscale Serve rule have already been removed on this host. This
-- migration drops the dashboard's service-catalog row and re-creates
-- cortex_set_service_urls without the hermes-webui-host branch, so a future
-- re-run of SELECT cortex_set_service_urls(...) cannot resurrect the row.
--
-- Scope: ONLY the host-level Web UI. Hermes agent gateway / profile units
-- (hermes-gateway@*, hermes-profile@*, hermes-dashboard*) are unrelated and
-- stay. Per-profile Web UI installs (if any were created inside Incus
-- instances per prompts/tools/60-incus-project.md step 6.5) live outside
-- this DB and are removed at the host/instance level, not here.
--
-- All FKs on services() are ON DELETE CASCADE (alert_history, alert_rules,
-- service_badges, service_health_log), so the row delete cleans up cleanly.

DELETE FROM services WHERE slug = 'hermes-webui-host';

-- Replace cortex_set_service_urls with a copy of 021's body minus the
-- hermes-webui-host UPDATE line. Behaviour for every other slug is
-- unchanged.
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
