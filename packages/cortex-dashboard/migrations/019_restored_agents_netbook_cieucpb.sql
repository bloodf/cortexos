-- 019_restored_agents_netbook_cieucpb.sql
-- Register restored Netbook and CIEUCPB projects without embedding secrets.

INSERT INTO projects (slug, name, repo_url, primary_pm_account, messaging_mode, settings)
VALUES
  (
    'netbook',
    'Network Engineering Book',
    'https://github.com/bloodf/network-engineering-book',
    'telegram:netbook',
    'single',
    '{
      "openclaw_agents": [
        "netbook-pm",
        "netbook-author",
        "netbook-editor",
        "netbook-reviewer",
        "netbook-evaluator",
        "netbook-translator"
      ],
      "paperclip_roles": ["PM", "BOOK-AUTHOR", "BOOK-EDITOR", "BOOK-REVIEWER", "BOOK-EVALUATOR", "BOOK-TRANSLATOR"],
      "a2a_agent_ids": ["netbook-pm", "netbook-author", "netbook-editor", "netbook-reviewer", "netbook-evaluator", "netbook-translator"],
      "workspace": "/home/cortexos/Developer/github.com/netbook/network-engineering-book"
    }'::jsonb
  ),
  (
    'cieucpb',
    'CIEUCPB',
    NULL,
    'telegram:cieucpb',
    'single',
    '{
      "openclaw_agents": ["cieucpb"],
      "paperclip_roles": ["CIEUCPB"],
      "a2a_agent_ids": ["cieucpb"],
      "workspace": "/home/cortexos/.openclaw/workspace-cieucpb"
    }'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  repo_url = EXCLUDED.repo_url,
  primary_pm_account = EXCLUDED.primary_pm_account,
  messaging_mode = EXCLUDED.messaging_mode,
  settings = EXCLUDED.settings,
  updated_at = NOW();

DELETE FROM messaging_routes
WHERE account_ref IN ('telegram:netbook', 'telegram:cieucpb', 'whatsapp:cieucpb');

WITH project_rows AS (
  SELECT id, slug FROM projects WHERE slug IN ('netbook', 'cieucpb')
)
INSERT INTO messaging_routes (project_id, platform, account_ref, route_config, approval_gates)
SELECT id, 'telegram', 'telegram:netbook', '{"agent":"netbook-pm"}'::jsonb, ARRAY['review:plan','review:diff']::TEXT[]
FROM project_rows WHERE slug = 'netbook'
UNION ALL
SELECT id, 'telegram', 'telegram:cieucpb', '{"agent":"cieucpb"}'::jsonb, ARRAY['review:plan','review:diff','backup:confirm']::TEXT[]
FROM project_rows WHERE slug = 'cieucpb'
UNION ALL
SELECT id, 'whatsapp', 'whatsapp:cieucpb', '{"agent":"cieucpb"}'::jsonb, ARRAY['review:plan','review:diff','backup:confirm']::TEXT[]
FROM project_rows WHERE slug = 'cieucpb';

INSERT INTO agent_factories (slug, name, kind, schema_version, definition, created_by)
VALUES (
  'netbook-book-writing',
  'Netbook Book Writing',
  'project',
  2,
  '{
    "template":"templates/agent-workflows/book-writing/README.md",
    "project_slug":"netbook",
    "repo_url":"https://github.com/bloodf/network-engineering-book",
    "workflow":"book-writing",
    "paperclip":{
      "required_roles":[
        {"role":"PM","agent_id":"netbook-pm"},
        {"role":"BOOK-AUTHOR","agent_id":"netbook-author"},
        {"role":"BOOK-EDITOR","agent_id":"netbook-editor"},
        {"role":"BOOK-REVIEWER","agent_id":"netbook-reviewer"},
        {"role":"BOOK-EVALUATOR","agent_id":"netbook-evaluator"},
        {"role":"BOOK-TRANSLATOR","agent_id":"netbook-translator"}
      ],
      "work_subject_pattern":"cortex.paperclip.work.{role}",
      "project_context_key":"context.projectSlug"
    },
    "a2a":{
      "port":18802,
      "agent_ids":["netbook-pm","netbook-author","netbook-editor","netbook-reviewer","netbook-evaluator","netbook-translator"]
    }
  }'::jsonb,
  'system'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  schema_version = EXCLUDED.schema_version,
  definition = EXCLUDED.definition,
  updated_at = NOW();

INSERT INTO migrations (name) VALUES ('019_restored_agents_netbook_cieucpb')
ON CONFLICT (name) DO NOTHING;
