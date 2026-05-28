-- Superseded by the rebuild catalog in 002_seed.sql.

INSERT INTO migrations (name) VALUES ('013_backend_services')
ON CONFLICT (name) DO NOTHING;
