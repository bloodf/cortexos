-- 016_agent_factory_seed.rollback.sql
DELETE FROM agent_factories
WHERE created_by = 'system'
  AND (slug LIKE 'role-%' OR slug LIKE 'workflow-%');
DELETE FROM migrations WHERE name = '016_agent_factory_seed';
