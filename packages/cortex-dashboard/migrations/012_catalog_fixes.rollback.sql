-- 012_catalog_fixes.rollback.sql
-- Revert health_url and env_source for 9router and agentgateway to the
-- values originally seeded by 002_seed.sql.

UPDATE services
   SET health_url = 'http://host.docker.internal:20128/api/health',
       env_source = '/opt/cortexos/stacks/9router/.env',
       updated_at = NOW()
 WHERE slug = '9router';

UPDATE services
   SET health_url = 'http://host.docker.internal:15021/healthz/ready',
       env_source = '/opt/cortexos/stacks/agentgateway/.env',
       updated_at = NOW()
 WHERE slug = 'agentgateway';

DELETE FROM migrations WHERE name = '012_catalog_fixes';
