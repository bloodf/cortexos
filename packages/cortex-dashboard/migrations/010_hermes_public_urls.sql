UPDATE services
SET open_url = '#',
    updated_at = NOW()
WHERE slug = 'hermes-primary';

UPDATE services
SET open_url = '#',
    updated_at = NOW()
WHERE slug = 'hermes-secondary';

UPDATE services
SET open_url = '#',
    health_url = 'http://127.0.0.1:9119/',
    has_webui = true,
    show_in_webui = true,
    updated_at = NOW()
WHERE slug = 'hermes-dashboard';

INSERT INTO migrations (name) VALUES ('010_hermes_public_urls')
ON CONFLICT (name) DO NOTHING;
