-- Migration 012: /apps webui listing flags (MP-022 / 022b)
--
-- Host-agnostic by design (revised):
--   This migration used to hardcode every web UI's open_url as
--   https://<tailnet-host>:PORT/. That baked one install's tailnet hostname
--   into the (public) repo. The per-install URL assignment now lives in
--   cortex_set_service_urls(base_url) (migration 019), where the host is a
--   runtime argument — so no hostname is committed here. Apply per host:
--
--     SELECT cortex_set_service_urls('https://<your-tailnet-host>');
--
--   This migration keeps only the host-agnostic visibility flags.
--
-- Discovered during the URL battery (still valid):
--   - cAdvisor lives at /cadvisor/ (--url_base_prefix); the proc encodes that.
--   - Loki is API-only with no built-in web UI → hidden from /apps.
--   - Obot serves 404 on probed UI paths → hidden from /apps.
--   - NexusGate rows point at a separate appliance (a different host); their
--     URLs are operator-specific and are NOT set by tracked code.
--
-- Idempotency: same value every run.

-- Web-UI rows are listed on /apps.
UPDATE services
SET show_in_webui = true
WHERE has_webui = true;

-- Loki has no built-in web UI (API-only); remove from webui listing.
UPDATE services
SET has_webui = false, show_in_webui = false
WHERE slug = 'loki';

-- Obot serves 404 on all probed UI paths; hide from /apps until reachable.
UPDATE services
SET show_in_webui = false
WHERE slug = 'obot';
