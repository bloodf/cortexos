DELETE FROM agent_factories WHERE slug = 'netbook-book-writing' AND created_by = 'system';
DELETE FROM messaging_routes
WHERE account_ref IN ('telegram:netbook', 'telegram:cieucpb', 'whatsapp:cieucpb');
DELETE FROM projects WHERE slug IN ('netbook', 'cieucpb');
DELETE FROM migrations WHERE name = '019_restored_agents_netbook_cieucpb';
