-- Placeholder: reserves the 016 gap in the migration sequence (015 → 017).
-- No schema changes. Kept so databases with this migration name
-- remain compatible with the sorted migration runner.

INSERT INTO migrations (name) VALUES ('016_placeholder')
ON CONFLICT (name) DO NOTHING;
