-- Add mail guardian widgets to the default operator dashboard layout.

UPDATE dashboard_layouts
SET layout = jsonb_set(
  layout::jsonb,
  '{rows}',
  (
    layout::jsonb->'rows'
  ) || '[{"items":["mail-guardian","mail-guardian-reviews"]}]'::jsonb,
  true
),
updated_at = NOW()
WHERE user_id = 1
  AND NOT (layout::jsonb::text LIKE '%mail-guardian%');

INSERT INTO migrations (name) VALUES ('005_mail_guardian_widgets')
ON CONFLICT (name) DO NOTHING;
