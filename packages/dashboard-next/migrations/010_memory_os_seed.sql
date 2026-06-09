-- Migration 010: Service catalog seed for the Memory OS launcher.
--
-- Background (.mavis/plans/plan_0450a939 task F-3 + W66):
--   Memory OS (ClaudioDrews/memory-os) is the 7-layer long-term memory
--   operating system that the Hermes Agent loads via the Icarus plugin
--   (per `prompts/tools/33-hermes-memory-os.md`). The install prompt
--   lays the stack on the HOST (Qdrant + Redis + ARQ worker + the
--   upstream `wiki` web UI), and a follow-up per-profile wiring task
--   surfaces it inside each Incus instance.
--
--   This migration seeds the HOST-level launcher entry so the
--   dashboard's /apps tile grid can render a clickable card before
--   the per-profile wiring lands. The /memory/ URL is reverse-proxied
--   by Caddy to the upstream `wiki` service (the install prompt at
--   33-hermes-memory-os.md pins the Caddy handle_path snippet as a
--   follow-up edit to 13-caddy.md).
--
-- Schema-locked-step posture:
--   - 001_schema.sql defined `services.kind VARCHAR(16)` + a CHECK
--     that did NOT include 'dashboard-launcher'.
--   - 009_hermes_webui_boxbox_seed.sql (W59) widened the column to
--     VARCHAR(32) and extended the CHECK to add 'dashboard-launcher'.
--   - 010 only seeds rows — no schema change. The widened column
--     and the extended CHECK are inherited from 009; re-asserting
--     them in 010 would be a redundant no-op (and would risk a
--     constraint-name collision if 009 ever changes the CHECK name).
--   - If 010 is ever run against a database that pre-dates 009
--     (e.g. a partial restore), the CHECK will reject the new
--     'dashboard-launcher' kind and the migration fails LOUDLY —
--     that's intentional, because silently downgrading kind would
--     hide the launcher from the /apps page.
--
-- Idempotency:
--   - The seed insert uses ON CONFLICT (slug) DO NOTHING so re-running
--     the migration does not duplicate rows. ON CONFLICT requires the
--     `services.slug` unique constraint that 001_schema.sql establishes
--     (services_slug_key).
--
-- Health-check posture:
--   - The upstream `wiki` web UI (the Caddy-reverse-proxied surface)
--     does NOT expose a /health endpoint in v0.2.0 (the upstream repo
--     has no healthcheck in its docker-compose.yml). We use a synthetic
--     loopback URL against Qdrant (`:6333/healthz`) as the health probe
--     — Qdrant is the dependency that's most likely to be down if the
--     stack is misconfigured, and Qdrant exposes a real /healthz that
--     returns 200 OK when the vector store is ready.
--   - show_in_healthcheck=true so the existing /services page prober
--     tries the URL and surfaces a "down" badge if Qdrant is offline.
--   - has_webui=false because the launcher is a link-out (openUrl),
--     not an in-dashboard surface.
--
-- Sort order:
--   - The brief says "boxbox.sortOrder + 1". The 009 seed gave Hermes
--     Web UI host sortOrder=20 and BoxBox host sortOrder=21, so the
--     new Memory OS host row lands at sortOrder=22. This keeps
--     /services and /apps in a stable order: Hermes Web UI < BoxBox <
--     Memory OS.
--
-- The seed values are the canonical defaults. Operators running in
-- non-default port configurations should UPDATE the row after the
-- `prompts/tools/33-hermes-memory-os.md` install runs.

-- ---------------------------------------------------------------------------
-- 1. Schema preconditions — verify and abort loudly if 009 didn't run.
--
-- The `dashboard-launcher` value is in services_kind_check since 009.
-- If the CHECK does not contain it, 010 is being run against a
-- pre-009 database; the right fix is to apply 009 first, not to
-- silently expand the constraint here. (If we did, we'd hide the
-- schema-drift signal from the operator.)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conname = 'services_kind_check'
    AND conrelid = 'services'::regclass;

  IF constraint_def IS NULL THEN
    RAISE EXCEPTION 'services_kind_check is missing — apply migration 001 first';
  END IF;

  IF constraint_def NOT LIKE '%dashboard-launcher%' THEN
    RAISE EXCEPTION 'services_kind_check does not include ''dashboard-launcher'' — apply migration 009 first (constraint is: %)', constraint_def;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Seed the Memory OS dashboard-launcher row.
-- ---------------------------------------------------------------------------

INSERT INTO services (
  slug, name, kind, category, description,
  health_url, health_type, open_url, env_source,
  status, icon_type, icon_color, icon_image,
  sort_order, is_active, has_webui, show_in_healthcheck, show_in_webui
) VALUES
  -- Memory OS — host-level, Caddy routes /memory/ to the upstream
  -- `wiki` web UI (reverse-proxy snippet is a 13-caddy.md follow-up;
  -- the install prompt 33-hermes-memory-os.md documents the path).
  (
    'memory-os-host',
    'Memory OS',
    'dashboard-launcher',
    'Operator Interfaces',
    '7-layer memory operating system for Hermes Agent (Qdrant + Redis + ' ||
    'ARQ + Icarus plugin). See prompts/tools/33-hermes-memory-os.md. ' ||
    'Layered on top of Honcho.',
    'http://127.0.0.1:6333/healthz',  -- Qdrant readiness probe; the wiki UI has no /health in v0.2.0
    'http',
    '/memory/',
    NULL,
    'unknown',
    'auto',
    NULL,
    NULL,
    22,    -- sorts right after BoxBox (sortOrder=21) on the /services page
    true,
    false,  -- has_webui=false — link-out, not in-dashboard
    true,   -- show_in_healthcheck=true — Qdrant readiness is a real signal
    true    -- show_in_webui=true — appears in /services AND /apps
  )
ON CONFLICT (slug) DO NOTHING;
