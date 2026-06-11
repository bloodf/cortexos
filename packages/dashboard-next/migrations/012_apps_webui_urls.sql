-- Migration 012: /apps webui-only listing + working tailscale:port URLs (MP-022 022b)
--
-- Amended URL scheme (post-022a, evidence-driven):
--   Every has_webui=true row gets open_url = 'https://cortexos.tailfd052e.ts.net:PORT/'
--   (uniform; trailing slash).  NexusGate rows use http://100.68.46.47:PORT.
--   Cortex Dashboard keeps the bare host root (documented exception).
--   show_in_webui is aligned to has_webui for all web-UI rows.
--
-- Adjustments discovered during URL battery:
--   - cAdvisor is configured with --url_base_prefix=/cadvisor, so its UI
--     lives at /cadvisor/; open_url includes the path.
--   - Loki is API-only with no built-in web UI; has_webui and show_in_webui
--     are set false so it does not appear in /apps.
--   - Obot serves 404 on all probed paths (/, /ui, /admin); per plan
--     instruction show_in_webui is set false.
--
-- Idempotency: updates are idempotent (same value every run).

UPDATE services
SET
  open_url = CASE slug
    WHEN 'boxbox-host'           THEN 'https://cortexos.tailfd052e.ts.net:8200/'
    WHEN 'cadvisor'              THEN 'https://cortexos.tailfd052e.ts.net:8081/cadvisor/'
    WHEN 'dockhand'              THEN 'https://cortexos.tailfd052e.ts.net:3420/'
    WHEN 'hermes-webui-host'     THEN 'https://cortexos.tailfd052e.ts.net:18787/'
    WHEN 'home-assistant'        THEN 'https://cortexos.tailfd052e.ts.net:8123/'
    WHEN 'jellyfin'              THEN 'https://cortexos.tailfd052e.ts.net:8096/'
    WHEN 'memory-os-host'        THEN 'https://cortexos.tailfd052e.ts.net:6333/'
    WHEN 'mongo-express'         THEN 'https://cortexos.tailfd052e.ts.net:8083/'
    WHEN 'nexusgate-adguard'     THEN 'http://100.68.46.47:3000/'
    WHEN 'nexusgate-luci'        THEN 'http://100.68.46.47:80/'
    ELSE open_url
  END,
  show_in_webui = true
WHERE has_webui = true;

-- Loki has no built-in web UI (API-only); remove from webui listing.
UPDATE services
SET has_webui = false, show_in_webui = false
WHERE slug = 'loki';

-- Obot serves 404 on all probed UI paths; keep has_webui=true (it does
-- expose a web UI when running) but hide from /apps until reachable.
UPDATE services
SET show_in_webui = false
WHERE slug = 'obot';
