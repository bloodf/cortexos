-- Migration 013: Obot has no working web UI (022b review fix-forward)
--
-- 022b evidence shows Obot returns 404 on /, /ui, and /admin. The /apps
-- page filters on has_webui, so hide Obot by clearing has_webui rather
-- than only show_in_webui.
--
-- Idempotency: the UPDATE is a no-op when has_webui is already false.

UPDATE services
SET has_webui = false
WHERE slug = 'obot';

INSERT INTO migrations (name) VALUES ('013_obot_no_webui') ON CONFLICT DO NOTHING;
