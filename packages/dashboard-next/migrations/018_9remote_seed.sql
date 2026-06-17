-- Migration 018: Seed the 9Remote service-catalog row.
--
-- 9Remote (https://9remote.cc) runs as cortex-9remote.service in web-UI mode
-- (`9remote ui`), serving a browser terminal on :2208. See
-- prompts/tools/30f-9remote.md.
--
-- Probe note:
--   `/` returns 403 until a device is paired (that is the auth gate), so the
--   health probe targets /api/health (200 regardless of pairing). Loopback
--   only — no per-install hostname here.
--
-- Host-agnostic Apps URL:
--   open_url is the install's tailnet host and must stay dynamic / out of the
--   public repo, so it is left '#' here and assigned by
--   cortex_set_service_urls(base_url) (migration 019). 9remote ui binds
--   0.0.0.0 and cannot be tailscale-served on its own port, so the proc builds
--   a plain-http URL over the (wireguard-encrypted) tailnet.
--
-- Visibility flags set explicitly (dynamic-seed.js is dropped — see 017's
-- note). Idempotent UPSERT.

INSERT INTO services (
  slug, name, kind, category, description,
  health_url, health_type, open_url,
  is_active, show_in_healthcheck, has_webui, show_in_webui
) VALUES
  (
    '9remote', '9Remote', 'service', 'AI',
    'Browser-based remote terminal for the host (web-UI mode, tunnel-free). ' ||
    'See prompts/tools/30f-9remote.md.',
    'http://127.0.0.1:2208/api/health', 'http', '#',
    true, true, false, false
  )
ON CONFLICT (slug) DO UPDATE SET
  health_url          = EXCLUDED.health_url,
  health_type         = EXCLUDED.health_type,
  is_active           = EXCLUDED.is_active,
  show_in_healthcheck = EXCLUDED.show_in_healthcheck,
  updated_at          = NOW();
