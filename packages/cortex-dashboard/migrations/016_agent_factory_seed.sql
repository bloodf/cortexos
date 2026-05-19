-- 016_agent_factory_seed.sql
-- Seed the dashboard Agent Factory registry from the generic templates shipped
-- with CortexOS. Definitions intentionally reference template paths instead of
-- embedding host-specific data or credentials.

INSERT INTO agent_factories (slug, name, kind, schema_version, definition, created_by)
VALUES
  ('role-book-author', 'Book Author', 'role', 1, '{"template":"templates/agent-roles/BOOK-AUTHOR.md"}'::jsonb, 'system'),
  ('role-book-editor', 'Book Editor', 'role', 1, '{"template":"templates/agent-roles/BOOK-EDITOR.md"}'::jsonb, 'system'),
  ('role-book-evaluator', 'Book Evaluator', 'role', 1, '{"template":"templates/agent-roles/BOOK-EVALUATOR.md"}'::jsonb, 'system'),
  ('role-book-reviewer', 'Book Reviewer', 'role', 1, '{"template":"templates/agent-roles/BOOK-REVIEWER.md"}'::jsonb, 'system'),
  ('role-book-translator', 'Book Translator', 'role', 1, '{"template":"templates/agent-roles/BOOK-TRANSLATOR.md"}'::jsonb, 'system'),
  ('role-ceo', 'CEO', 'role', 1, '{"template":"templates/agent-roles/CEO.md"}'::jsonb, 'system'),
  ('role-cortex', 'Cortex', 'role', 1, '{"template":"templates/agent-roles/CORTEX.md"}'::jsonb, 'system'),
  ('role-cto', 'CTO', 'role', 1, '{"template":"templates/agent-roles/CTO.md"}'::jsonb, 'system'),
  ('role-eng-backend', 'Backend Engineer', 'role', 1, '{"template":"templates/agent-roles/ENG-BACKEND.md"}'::jsonb, 'system'),
  ('role-eng-esp32', 'ESP32 Engineer', 'role', 1, '{"template":"templates/agent-roles/ENG-ESP32.md"}'::jsonb, 'system'),
  ('role-eng-frontend', 'Frontend Engineer', 'role', 1, '{"template":"templates/agent-roles/ENG-FRONTEND.md"}'::jsonb, 'system'),
  ('role-eng-mobile', 'Mobile Engineer', 'role', 1, '{"template":"templates/agent-roles/ENG-MOBILE.md"}'::jsonb, 'system'),
  ('role-engineer', 'Engineer', 'role', 1, '{"template":"templates/agent-roles/ENGINEER.md"}'::jsonb, 'system'),
  ('role-pm', 'Product Manager', 'role', 1, '{"template":"templates/agent-roles/PM.md"}'::jsonb, 'system'),
  ('role-po', 'Product Owner', 'role', 1, '{"template":"templates/agent-roles/PO.md"}'::jsonb, 'system'),
  ('role-qa', 'QA', 'role', 1, '{"template":"templates/agent-roles/QA.md"}'::jsonb, 'system'),
  ('role-staff-eng', 'Staff Engineer', 'role', 1, '{"template":"templates/agent-roles/STAFF-ENG.md"}'::jsonb, 'system'),
  ('role-uxui', 'UX/UI', 'role', 1, '{"template":"templates/agent-roles/UXUI.md"}'::jsonb, 'system'),
  ('workflow-agent-mention-router', 'Agent Mention Router', 'workflow', 1, '{"template":"templates/workflows/agent-mention-router.yml"}'::jsonb, 'system'),
  ('workflow-ai-review-request', 'AI Review Request', 'workflow', 1, '{"template":"templates/workflows/ai-review-request.yml"}'::jsonb, 'system'),
  ('workflow-gate-enforcement', 'Gate Enforcement', 'workflow', 1, '{"template":"templates/workflows/gate-enforcement.yml"}'::jsonb, 'system'),
  ('workflow-pipeline', 'Workflow Pipeline', 'workflow', 1, '{"template":"templates/workflows/workflow-pipeline.yml"}'::jsonb, 'system')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  schema_version = EXCLUDED.schema_version,
  definition = EXCLUDED.definition,
  updated_at = NOW();

INSERT INTO migrations (name) VALUES ('016_agent_factory_seed')
ON CONFLICT (name) DO NOTHING;
