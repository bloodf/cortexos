-- Add machine sensor widget to existing operator dashboard layouts.

UPDATE dashboard_layouts
SET layout = jsonb_set(
  layout::jsonb,
  '{rows}',
  (layout::jsonb->'rows') || '[{"items":["machine-sensors"]}]'::jsonb,
  true
),
updated_at = NOW()
WHERE user_id = 1
  AND NOT (layout::jsonb::text LIKE '%machine-sensors%');

INSERT INTO migrations (name) VALUES ('006_machine_sensors_widget')
ON CONFLICT (name) DO NOTHING;
