-- 017_paperclip_agent_factory.rollback.sql
DELETE FROM agent_factories WHERE slug = 'paperclip-startup-company' AND created_by = 'system';
DELETE FROM migrations WHERE name = '017_paperclip_agent_factory';
