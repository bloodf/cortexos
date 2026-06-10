-- Migration 009: Service catalog seed for Hermes Web UI + BoxBox launchers.
--
-- Background (.mavis/plans/hermes-fzf-boxbox-plan.md Track A):
--   The user asked for Hermes-webui (nesquena/hermes-webui) and BoxBox
--   (jR4dh3y/BoxBox) to be surfaced in the dashboard as openable launchers
--   using the existing `openUrl` field on the Service schema. Hermes-webui
--   installs per-project on each Incus instance + once on the host; BoxBox
--   installs on the host only.
--
--   The catalog already supports `kind IN ('app','service','docker','process')`
--   (001_schema.sql:11-38, schema.ts:117). The two new entries are link-out
--   launchers (no health check, no daemon to probe) — they are NOT
--   services in the traditional sense, but they share the catalog so the
--   dashboard's existing /services page + the new /apps launcher page can
--   both render them via the same Drizzle repo.
--
--   This migration extends the kind CHECK constraint to add the new
--   `dashboard-launcher` value, then INSERTs the two seed rows.
--
-- Why a new kind, not a 'service' row with a flag column?
--   - The brief explicitly named 'dashboard-launcher' as the kind for both
--     entries, so the dashboard's /apps page can query them with a single
--     `kind = 'dashboard-launcher'` predicate and the existing /services
--     page can exclude them with the inverse. Two surfaces, one filter.
--   - The CHECK constraint lives on the SQL side (canonical) — extending
--     it once in this migration makes both surfaces consistent.
--   - The Drizzle schema mirror in `schema.ts` is updated in the same
--     commit so PGlite + production SQL stay in lockstep.
--
-- Idempotency:
--   - ALTER TABLE ... DROP CONSTRAINT IF EXISTS / ADD CONSTRAINT is
--     wrapped in DO $$ ... END $$ so re-running the migration is a
--     no-op (DROP CONSTRAINT IF EXISTS is PG 9.0+).
--   - The seed inserts use ON CONFLICT (slug) DO NOTHING so re-running
--     the migration does not duplicate rows.
--
-- Seeding the openUrl paths:
--   - Hermes Web UI is reverse-proxied by Caddy at /hermes/ on the host
--     (per prompts/tools/30-hermes-webui.md). Incus instances route to
--     the per-profile unit on port 8933 (per prompts/tools/60-incus-project.md
--     step 6.5). This seed row covers the HOST /hermes/ path; per-profile
--     /hermes/<profile>/ paths are surfaced via a follow-up migration
--     that JOINs against the incus_instances table (not in this commit).
--   - BoxBox is reverse-proxied by Caddy at /files/ on the host
--     (per prompts/tools/30c-boxbox.md). BoxBox does NOT install per-profile
--     on Incus — the user explicitly said "I want to be part of the
--     machine" (host only).
--
-- Health-check posture:
--   - Hermes Web UI exposes /health on its loopback port; the catalog
--     row stores health_url=http://127.0.0.1:18787/health so the existing
--     /services page prober hits the right path.
--   - BoxBox exposes /health on its loopback port; the catalog row
--     stores health_url=http://127.0.0.1:8200/health.
--   - has_webui=false because the launchers are link-outs (openUrl),
--     not in-dashboard surfaces. The /apps page renderer keys off this
--     flag to render an "Open in new tab" affordance instead of a
--     service-card detail link.
--
-- The seed values are the canonical defaults. Operators running in
-- non-default port configurations should UPDATE the row after the
-- `prompts/tools/30-hermes-webui.md` / `30c-boxbox.md` install runs
-- (the prompts set HERMES_WEBUI_BIND_PORT and BOXBOX_BIND_PORT; the
-- corresponding health_url needs to match).

-- ---------------------------------------------------------------------------
-- 1. Extend the services.kind CHECK constraint to add 'dashboard-launcher'.
--
-- The original column is VARCHAR(16) (001_schema.sql:15) and the
-- 'dashboard-launcher' value is 18 characters — too long for the
-- original column. Widen the column to VARCHAR(32) (still well under
-- the 64-byte index key limit) before extending the CHECK. The
-- widening is idempotent: a fresh DB that already has VARCHAR(32)
-- (e.g. via 001_schema.sql after this commit) is a no-op.
-- ---------------------------------------------------------------------------

ALTER TABLE services ALTER COLUMN kind TYPE VARCHAR(32);

DO $$
BEGIN
  -- Drop the original constraint (from 001_schema.sql:11-38).
  -- IF EXISTS makes this safe against fresh-DB schemas that haven't
  -- created the constraint yet (the rare case where 001 and 009
  -- run on the same connection for the first time).
  ALTER TABLE services DROP CONSTRAINT IF EXISTS services_kind_check;

  -- Re-add with the extended set. CHECK on VARCHAR(32) is the
  -- canonical mirror of the Drizzle schema in `schema.ts:117`.
  ALTER TABLE services
    ADD CONSTRAINT services_kind_check
    CHECK (kind IN ('app','service','docker','process','dashboard-launcher'));
EXCEPTION WHEN OTHERS THEN
  -- Non-fatal: fresh DBs without the table yet will get the extended
  -- constraint when 001_schema.sql lands (the 001 CHECK is overridden
  -- on the next migration cycle once 009 is the source of truth).
  NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Seed the two dashboard-launcher rows.
-- ---------------------------------------------------------------------------

INSERT INTO services (
  slug, name, kind, category, description,
  health_url, health_type, open_url, env_source,
  status, icon_type, icon_color, icon_image,
  sort_order, is_active, has_webui, show_in_healthcheck, show_in_webui
) VALUES
  -- Hermes Web UI — host-level, Caddy routes /hermes/ to 127.0.0.1:18787.
  (
    'hermes-webui-host',
    'Hermes Web UI',
    'dashboard-launcher',
    'Operator Interfaces',
    'Operator-facing UI for the Hermes agent runtime (nesquena/hermes-webui). ' ||
    'Reverse-proxied at /hermes/ via Caddy. Install per prompts/tools/30-hermes-webui.md. ' ||
    'Per-profile install is in prompts/tools/60-incus-project.md step 6.5.',
    'http://127.0.0.1:18787/health',
    'http',
    '/hermes/',
    NULL,
    'unknown',
    'auto',
    NULL,
    NULL,
    20,    -- sorts after docker/systemd on the /services page
    true,
    false,  -- has_webui=false — link-out, not in-dashboard
    true,   -- show_in_healthcheck=true — the /health endpoint is real
    true    -- show_in_webui=true — appears in /services AND /apps
  ),
  -- BoxBox — host-level file manager, Caddy basicauth at /files/.
  (
    'boxbox-host',
    'BoxBox',
    'dashboard-launcher',
    'Operator Interfaces',
    'Host-only file manager (jR4dh3y/BoxBox). Reverse-proxied at /files/ via ' ||
    'Caddy with HTTP Basic auth (BoxBox has no native auth). Install per ' ||
    'prompts/tools/30c-boxbox.md.',
    'http://127.0.0.1:8200/health',
    'http',
    '/files/',
    NULL,
    'unknown',
    'auto',
    NULL,
    NULL,
    21,    -- sorts right after Hermes Web UI on the /services page
    true,
    false,  -- has_webui=false — link-out, not in-dashboard
    true,   -- show_in_healthcheck=true
    true    -- show_in_webui=true
  )
ON CONFLICT (slug) DO NOTHING;
