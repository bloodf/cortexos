# MP-023 — /healthcheck: tabs (Health | Logs), wire the incident timeline

Operator directive: split the log into its own tab/page; show the apps'
healthchecks. Evidence: recon Q3 — page = DataTable (healthcheckList,
3s) + placeholder "Alert history not yet wired (WP-17)" + LogStream on
one page; service_health_log table exists.

## File ownership (NOTHING else)
- src/features/Healthcheck.tsx; src/routes/_authenticated.healthcheck.tsx
  (only if the tab search-param needs route-level validateSearch);
  a NEW test file src/features/__tests__/healthcheck-tabs.test.tsx (or
  the page's existing test file); CONDITIONAL (only if Task 3's quoted
  query proves app rows are filtered out): EXACTLY
  src/server/db/repos/services.ts and
  src/server/db/repos/__tests__/services.test.ts (healthcheckList is a
  client.ts view over listServices — ORCHESTRATOR-VERIFIED 2026-06-11 by
  direct grep: client.ts:725 comment "Paginated healthcheck view —
  services with activeOnly=true", :727 `healthcheckList: async` — this
  supersedes the recon's "not yet found" note). Report:
  artifacts/impl-mp-023-report.md (never committed).

## Tasks (kimi) — TDD ORDER
0. RED first: write the tab test (vitest + testing-library, the repo's
   established component-test pattern) asserting (a) the page renders
   two tabs labeled Health and Logs, (b) the Logs tab content contains
   the log stream container while Health shows the DataTable, (c) the
   incident timeline region renders alert-history rows (mock the query
   layer per the repo's pattern), AND (d) rendering with the
   `?tab=logs` search param makes the Logs tab the active panel (the
   deep-link binary assertion) — run: FAILS (quote).
1. Restructure src/features/Healthcheck.tsx into two tabs (shadcn Tabs,
   matching the repo's existing tab usage): "Health" = the DataTable +
   incident timeline; "Logs" = the LogStream (admin-only behavior
   unchanged). Tab state in URL search param (?tab=logs) so it
   deep-links. RED assertions (a), (b), (d) now pass; assertion (c)
   (timeline rows) REMAINS RED until Task 2 — quote the partial state.
2. Wire the incident timeline: replace the placeholder with alert
   history (api.alerts.history — the LIVE domain /alerts already uses);
   render EXACTLY the latest 20 entries (slice(0, 20)) with
   status/time/service. NOW assertion (c) passes — full RED test green;
   quote.
3. Apps' health visibility (directive-scoped): quote the healthcheckList
   path (client.ts:727 → listServices) and the effective query; verify
   every has_webui=true services row WITH health config
   (health_url/health_type set) appears in the Health table. IF any such
   app row is excluded: TDD — first add a RED case to
   src/server/db/repos/__tests__/services.test.ts asserting the row
   appears (FAILS, quote), then widen the query minimally in
   services.ts (GREEN), quote before/after row counts via psql. If no
   row is excluded: state so with the psql proof; no repo change.

## Gates (binary, quote each)
- `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` → exit 0
- `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run'`
  → zero failures, total ≥ 579 (578 + the new tab test file)
- `pnpm --filter @cortexos/dashboard-next build` → exit 0
- `pnpm run format:check 2>&1 | tail -1` → exit 0 ("All matched files
  use Prettier code style!")
- Screens (orchestrator, post-deploy):
  `node packages/dashboard-next/scripts/verify-screens.mjs` via the
  harness wp-b job → exit 0 AND PASS 18 / FAIL 0.

## Out of scope
- /alerts page; the health scheduler; LogStream internals; any service
  row data changes; non-app health semantics beyond Task 3's minimal
  widening.

Commit: feat(dashboard-next): healthcheck tabs — health table + wired incident timeline, logs split out (MP-023)
