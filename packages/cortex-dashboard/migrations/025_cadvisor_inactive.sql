-- cadvisor container not deployed on host, route is dead.
-- Marking as inactive so the catalog does not render a broken link.
-- rollback: UPDATE services SET is_active = true WHERE slug = 'cadvisor';

UPDATE services
   SET is_active = false, updated_at = NOW()
 WHERE slug = 'cadvisor';

INSERT INTO migrations (name) VALUES ('025_cadvisor_inactive')
ON CONFLICT (name) DO NOTHING;
