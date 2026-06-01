-- Incus instance provisioning: saved wizard configs + lifecycle.
-- The dashboard wizard writes one row per project-instance it provisions.
-- `config` is the full IncusInstanceConfig JSONB (secrets stored only by
-- reference/name, never values). Live container state is read from incus at
-- request time; this table is the declarative + lifecycle record.
CREATE TABLE IF NOT EXISTS incus_instances (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','validated','provisioning','active','failed')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_validation JSONB DEFAULT NULL,
  last_request_id UUID DEFAULT NULL,
  created_by TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incus_instances_status ON incus_instances(status);
CREATE INDEX IF NOT EXISTS idx_incus_instances_slug ON incus_instances(slug);

-- Global wizard defaults + admin-selected AI model live in the key/value
-- `config` table (created in 001_schema.sql). Seed defaults idempotently.
INSERT INTO config (key, value) VALUES
  ('incus.wizard.defaults',
   '{"image":"cortexos-base/latest","ghOrg":"bloodf","bridge":"incusbr0","pool":"cortex-zfs","branch":"main","proxies":["9router","honcho","ollama"]}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO config (key, value) VALUES
  ('incus.ai.model', '')
ON CONFLICT (key) DO NOTHING;
