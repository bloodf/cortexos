-- 017_paperclip_agent_factory.sql
-- Paperclip-aligned project factory seed. The definition models startup
-- organization seats/positions so Agent Factory and Paperclip create the same
-- lane topology and role bindings.

INSERT INTO agent_factories (slug, name, kind, schema_version, definition, created_by)
VALUES (
  'paperclip-startup-company',
  'Paperclip Startup Company',
  'project',
  2,
  '{
    "template":"templates/agent-factory/README.md",
    "paperclip":{
      "organization_kind":"startup_company",
      "project_slug":"paperclip-startup-company",
      "seat_model":"position",
      "required_positions":[
        {"seat":"ceo","title":"CEO","role_factory":"role-ceo","paperclip_role":"CEO","count":1},
        {"seat":"cto","title":"CTO","role_factory":"role-cto","paperclip_role":"CTO","count":1},
        {"seat":"pm","title":"Product Manager","role_factory":"role-pm","paperclip_role":"PM","count":1},
        {"seat":"po","title":"Product Owner","role_factory":"role-po","paperclip_role":"PO","count":1},
        {"seat":"staff-eng","title":"Staff Engineer","role_factory":"role-staff-eng","paperclip_role":"STAFF-ENG","count":1},
        {"seat":"eng-backend","title":"Backend Engineer","role_factory":"role-eng-backend","paperclip_role":"ENG-BACKEND","count":1},
        {"seat":"eng-frontend","title":"Frontend Engineer","role_factory":"role-eng-frontend","paperclip_role":"ENG-FRONTEND","count":1},
        {"seat":"qa","title":"QA Engineer","role_factory":"role-qa","paperclip_role":"QA","count":1},
        {"seat":"uxui","title":"UX/UI Designer","role_factory":"role-uxui","paperclip_role":"UXUI","count":1}
      ],
      "optional_positions":[
        {"seat":"eng-mobile","title":"Mobile Engineer","role_factory":"role-eng-mobile","paperclip_role":"ENG-MOBILE","count":1},
        {"seat":"eng-esp32","title":"ESP32 Engineer","role_factory":"role-eng-esp32","paperclip_role":"ENG-ESP32","count":1}
      ],
      "agent_slug_pattern":"{project}-{seat}",
      "nats_subject_pattern":"cortex.task.{project}.{seat}",
      "ticket_link_table":"paperclip_ticket_link"
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

INSERT INTO migrations (name) VALUES
  ('017_paperclip_agent_factory'),
  ('026_paperclip_agent_factory')
ON CONFLICT (name) DO NOTHING;
