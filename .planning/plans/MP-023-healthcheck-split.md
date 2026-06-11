# MP-023 — /healthcheck: tabs (Health | Logs), wire the incident timeline

Operator directive: split the log into its own tab/page; show the apps'
healthchecks. Evidence: recon Q3 — page = DataTable (healthcheckList,
3s) + placeholder "Alert history not yet wired (WP-17)" + LogStream on
one page; service_health_log table exists.

Tasks (kimi):
1. Restructure src/features/Healthcheck.tsx into two tabs (shadcn Tabs,
   matching the repo's existing tab usage): "Health" = the DataTable +
   incident timeline; "Logs" = the LogStream (admin-only behavior
   unchanged). Tab state in URL search param (?tab=logs) so it deep-links.
2. Wire the incident timeline: replace the placeholder with alert
   history scoped to health (api.alerts.history — the LIVE domain
   /alerts already uses; show latest ~20 with status/time/service).
3. Per-app health visibility: ensure every services row with
   health_url/health_type appears in the Health table (quote the
   healthcheckList repo query; if it filters out app rows, widen to all
   health-checked services).
Gates: tsc 0; suite zero failures (update/extend the page's tests);
build; screens (the /healthcheck route + new tab param).
Commit: feat(dashboard-next): healthcheck tabs — health table + wired incident timeline, logs split out (MP-023)
