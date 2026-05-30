-- Replace agentgateway catalog entry with Obot MCP Gateway Platform.
-- agentgateway was a custom Python MCP proxy; Obot is the replacement.
-- rollback: UPDATE services SET slug='agentgateway', name='AgentGateway', base_url='http://127.0.0.1:18800', open_url=base_url || '/tools', health_url='http://127.0.0.1:18800/health', health_type='http' WHERE slug='obot';

UPDATE services
   SET slug = 'obot',
       name = 'Obot',
       description = 'MCP Gateway Platform',
       base_url = 'http://127.0.0.1:8090',
       open_url = base_url,
       health_url = 'http://127.0.0.1:8090/',
       health_type = 'http',
       is_webui = true,
       updated_at = NOW()
 WHERE slug = 'agentgateway';

-- Update dynamic-seed spoke key reference if it exists
-- (handled in code: dynamic-seed.js spoke map)

INSERT INTO migrations (name) VALUES ('026_agentgateway_to_obot')
ON CONFLICT (name) DO NOTHING;
