-- The dashboard should monitor itself, but not list itself in the app launcher.
UPDATE services
SET has_webui = false,
    show_in_webui = false,
    updated_at = NOW()
WHERE slug = 'cortex-dashboard';

DELETE FROM service_badges
WHERE service_id = (SELECT id FROM services WHERE slug = 'cortex-dashboard')
  AND badge_id = (SELECT id FROM badges WHERE slug = 'app');

UPDATE agent_factories
SET definition = jsonb_set(
  definition,
  '{apps}',
  (definition->'apps') - 'cortex-dashboard'
)
WHERE definition->'apps' ? 'cortex-dashboard';

UPDATE projects
SET settings = jsonb_set(
  settings,
  '{apps}',
  (settings->'apps') - 'cortex-dashboard'
)
WHERE settings->'apps' ? 'cortex-dashboard';

-- Official upstream GitHub logos for apps not covered by developer-icons.
UPDATE services
SET icon_image = CASE slug
  WHEN '9router' THEN '/vendor-icons/9router.svg'
  WHEN 'honcho' THEN '/vendor-icons/honcho.svg'
  WHEN 'hermes-dashboard' THEN '/vendor-icons/hermes.svg'
  WHEN 'hermes-primary' THEN '/vendor-icons/hermes.svg'
  WHEN 'hermes-secondary' THEN '/vendor-icons/hermes.svg'
  WHEN 'langfuse' THEN '/vendor-icons/langfuse.svg'
  WHEN 'paperclip' THEN '/vendor-icons/paperclip.svg'
  ELSE icon_image
END,
updated_at = NOW()
WHERE slug IN ('9router', 'honcho', 'hermes-dashboard', 'hermes-primary', 'hermes-secondary', 'langfuse', 'paperclip');

INSERT INTO migrations (name) VALUES ('013_hide_dashboard_app_and_brand_icons')
ON CONFLICT (name) DO NOTHING;
