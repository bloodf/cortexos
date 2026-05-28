-- Superseded by the rebuild catalog in 002_seed.sql.
-- Kept as a no-op migration so existing databases with this migration name
-- remain compatible with the sorted migration runner.

INSERT INTO migrations (name) VALUES ('010_services_catalog_extras')
ON CONFLICT (name) DO NOTHING;
