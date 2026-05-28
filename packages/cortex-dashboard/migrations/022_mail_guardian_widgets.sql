-- Inject mail-guardian widgets into the default operator dashboard layout.
-- Uses the rebuild's dashboard_layouts jsonb shape: {"rows":[{"items":[...]}]}.
-- Only adds the row when neither widget is already present.

UPDATE dashboard_layouts
SET layout = jsonb_set(
  layout::jsonb,
  '{rows}',
  (layout::jsonb->'rows') || '[{"items":["mail-guardian","mail-guardian-reviews"]}]'::jsonb,
  true
),
updated_at = NOW()
WHERE user_id = 1
  AND NOT (layout::jsonb::text LIKE '%mail-guardian%');

INSERT INTO migrations (name) VALUES ('022_mail_guardian_widgets')
ON CONFLICT (name) DO NOTHING;
