UPDATE dashboard_layouts
SET layout = jsonb_set(
  layout::jsonb,
  '{rows}',
  (
    SELECT jsonb_agg(row_elem)
    FROM jsonb_array_elements(layout::jsonb->'rows') AS row_elem
    WHERE NOT (row_elem::text LIKE '%mail-guardian%')
  ),
  true
),
updated_at = NOW()
WHERE user_id = 1;
