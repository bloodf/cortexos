-- 012_catalog_fixes.sql
-- Catalog readiness review flagged
-- stale health_url and env_source values on backend-only AI catalog rows
-- seeded by 002_seed.sql. Reconcile them to match the actual spoke
-- prompts (prompts/tools/31-9router.md, 50-agentgateway.md) and the
-- canonical SOPS-decrypted secrets layout under /opt/cortexos/.secrets/.
--
-- Idempotent: targeted UPDATEs by slug. No INSERTs, no badge changes.
-- Re-running is safe — UPDATE simply overwrites with the same values.

-- 9Router: health probe is the upstream OpenAI-compatible /v1/models on
-- 11434 (loopback, not docker bridge). env file lives under
-- /opt/cortexos/.secrets/, not the legacy stacks/<name>/.env path.
UPDATE services
   SET health_url = 'http://127.0.0.1:11434/v1/models',
       env_source = '/opt/cortexos/.secrets/9router.env',
       updated_at = NOW()
 WHERE slug = '9router';

-- AgentGateway: real health endpoint is /health on 18800 (loopback).
-- The 15021 envoy-admin URL in 002_seed.sql was a paste from a
-- different spoke. Env file moves to the SOPS-managed location.
UPDATE services
   SET health_url = 'http://127.0.0.1:18800/health',
       env_source = '/opt/cortexos/.secrets/agentgateway.env',
       updated_at = NOW()
 WHERE slug = 'agentgateway';

INSERT INTO migrations (name) VALUES ('012_catalog_fixes')
ON CONFLICT (name) DO NOTHING;
