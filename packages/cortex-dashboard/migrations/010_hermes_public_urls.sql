UPDATE services
SET open_url = 'https://cortexos.tailfd052e.ts.net:18691/health',
    updated_at = NOW()
WHERE slug = 'hermes-primary';

UPDATE services
SET open_url = 'https://cortexos.tailfd052e.ts.net:18692/health',
    updated_at = NOW()
WHERE slug = 'hermes-secondary';

UPDATE services
SET open_url = 'https://cortexos.tailfd052e.ts.net:9119/',
    health_url = 'http://localhost:9119/',
    has_webui = true,
    show_in_webui = true,
    updated_at = NOW()
WHERE slug = 'hermes-dashboard';

INSERT INTO migrations (name) VALUES ('010_hermes_public_urls')
ON CONFLICT (name) DO NOTHING;
