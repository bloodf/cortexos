-- Backfill apps to all project/role factories missing it.
UPDATE agent_factories
SET definition = jsonb_set(
  definition,
  '{apps}',
  '["paperclip","honcho","9router","cortex-dashboard","langfuse"]'::jsonb
)
WHERE definition->'apps' IS NULL
  AND kind IN ('project', 'role');

-- Backfill apps to all projects missing it.
UPDATE projects
SET settings = jsonb_set(
  settings,
  '{apps}',
  '["paperclip","honcho","9router","cortex-dashboard","langfuse"]'::jsonb
)
WHERE settings->'apps' IS NULL;

INSERT INTO migrations (name) VALUES ('008_backfill_factory_apps')
ON CONFLICT (name) DO NOTHING;
