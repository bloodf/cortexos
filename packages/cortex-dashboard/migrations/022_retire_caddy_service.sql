-- Retire Caddy from the dashboard catalog. CortexOS now publishes all Web UIs
-- through Tailscale Serve port routing.

DELETE FROM services WHERE slug = 'caddy';

INSERT INTO migrations (name) VALUES
  ('019_retire_caddy_service'),
  ('022_retire_caddy_service')
ON CONFLICT (name) DO NOTHING;
