-- Migration 017: Fix the Honcho service-catalog probes + activate Honcho.
--
-- Background:
--   The honcho / honcho-mcp / ollama-honcho-embeddings-proxy rows predate the
--   migration-based catalog (no repo SQL ever seeded them). The live rows
--   carried a broken probe: health_type='process', health_url='honcho' — but
--   nothing on the host is literally named `honcho` (the API is the
--   `honcho-api` Docker container), so the probe never resolved and the API's
--   real health was invisible. The rows were also is_active=false /
--   show_in_healthcheck=false, so Honcho was missing from the dashboard.
--
-- Host-agnostic by design:
--   Health probes are loopback only (no per-install hostname). The public
--   Apps URL (open_url) is NOT set here — it is the install's tailnet host,
--   which must stay dynamic and out of the (public) repo. open_url is left as
--   '#'; the per-install URL is assigned by cortex_set_service_urls(base_url)
--   (see migration 019), whose host comes from a runtime argument.
--
-- Why this migration sets the visibility flags (not just the probe):
--   scripts/dynamic-seed.js was the intended owner of is_active / show_*, BUT
--   it is host-only/untracked and its dashboard-startup invocation was dropped
--   in the SvelteKit cutover (see
--   docs/internal/research/cortexos-audit-2026-06-05.md) — that is why the
--   live rows were stuck inactive. Migrations DO run at startup, so this is the
--   authoritative, tracked fix and sets is_active/show_in_healthcheck here.
--   has_webui/show_in_webui stay false until cortex_set_service_urls fills a
--   real open_url (it flips them then).
--
-- Idempotent UPSERT (same pattern as 009/010).

INSERT INTO services (
  slug, name, kind, category, description,
  health_url, health_type, open_url,
  is_active, show_in_healthcheck, has_webui, show_in_webui
) VALUES
  (
    'honcho', 'Honcho', 'service', 'AI',
    'Self-hosted Honcho memory backend (REST API; Swagger at /docs). ' ||
    'See prompts/tools/32-honcho.md.',
    'http://127.0.0.1:18690/health', 'http', '#',
    true, true, false, false
  ),
  (
    'honcho-mcp', 'Honcho MCP', 'service', 'AI',
    'Honcho MCP worker (StreamableHTTP via wrangler). systemd: honcho-mcp.service.',
    'honcho-mcp', 'process', '#',
    true, true, false, false
  ),
  (
    'ollama-honcho-embeddings-proxy', 'Ollama Honcho Embeddings Proxy',
    'service', 'AI',
    'Docker-network proxy exposing Vulkan Ollama embeddings to Honcho ' ||
    'containers. systemd: ollama-honcho-embeddings-proxy.service.',
    'ollama-honcho-embeddings-proxy', 'process', '#',
    true, true, false, false
  )
ON CONFLICT (slug) DO UPDATE SET
  health_url          = EXCLUDED.health_url,
  health_type         = EXCLUDED.health_type,
  is_active           = EXCLUDED.is_active,
  show_in_healthcheck = EXCLUDED.show_in_healthcheck,
  updated_at          = NOW();
