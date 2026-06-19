-- Migration 023: Services catalog cleanup — delete phantoms, activate
-- running services, surface hidden webuis.
--
-- Findings from the full catalog audit on 2026-06-19:
--   1. 8 phantom rows (no running service, stale duplicates, external IPs)
--   2. 6 services running but is_active=false (invisible to /apps + /healthcheck)
--   3. 4 running webuis hidden from /apps (has_webui=false)
--   4. cortex_set_service_urls must be called separately to fix open_url='#' rows.
--      NOT included here because the hostname is per-install (not portable).

-- ===========================================================================
-- 1. DELETE phantom rows
-- ===========================================================================

DELETE FROM services WHERE slug = 'hermes-netbook';      -- stale, no such service
DELETE FROM services WHERE slug = 'hermes-primary';      -- duplicate of hermes-netbook
DELETE FROM services WHERE slug = 'hermes-cieucpb';      -- gateway/profile exist under different names
DELETE FROM services WHERE slug = 'hermes-secondary';    -- duplicate of hermes-cieucpb
DELETE FROM services WHERE slug = 'caddy';               -- never deployed; system uses Tailscale Serve
DELETE FROM services WHERE slug = 'email-spam-poll';     -- duplicate of cortex-mail-guardian
DELETE FROM services WHERE slug = 'nexusgate-luci';      -- external IP (100.68.46.47), different host
DELETE FROM services WHERE slug = 'nexusgate-adguard';   -- external IP (100.68.46.47), different host

-- ===========================================================================
-- 2. ACTIVATE services that are running but is_active=false
-- ===========================================================================

UPDATE services SET is_active = true, updated_at = NOW()
  WHERE slug = 'obot' AND is_active = false;

UPDATE services SET is_active = true, updated_at = NOW()
  WHERE slug = 'boxbox-host' AND is_active = false;

UPDATE services SET is_active = true, updated_at = NOW()
  WHERE slug = 'memory-os-host' AND is_active = false;

UPDATE services SET is_active = true, updated_at = NOW()
  WHERE slug = 'snmp-exporter' AND is_active = false;

UPDATE services SET is_active = true, updated_at = NOW()
  WHERE slug = 'adguard-exporter' AND is_active = false;

UPDATE services SET is_active = true, updated_at = NOW()
  WHERE slug = 'cortex-mail-guardian' AND is_active = false;

-- ===========================================================================
-- 3. SURFACE hidden webuis (set has_webui=true + show_in_webui=true)
-- ===========================================================================

UPDATE services SET has_webui = true, show_in_webui = true, updated_at = NOW()
  WHERE slug = 'hindsight' AND has_webui = false;

UPDATE services SET has_webui = true, show_in_webui = true, updated_at = NOW()
  WHERE slug = 'hindsight-control-plane' AND has_webui = false;

UPDATE services SET has_webui = true, show_in_webui = true, updated_at = NOW()
  WHERE slug = 'kernel-browser' AND has_webui = false;

UPDATE services SET has_webui = true, show_in_webui = true, updated_at = NOW()
  WHERE slug = 'obot' AND has_webui = false;

