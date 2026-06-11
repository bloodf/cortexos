# MP-022 — /apps: webui-only listing, working tailscale:port URLs

Operator directives (2026-06-11, recorded): only show apps with a web UI;
every web UI reachable as tailscale-IP:port (http://100.109.20.9:PORT) —
no subdomains, no subfolders; REBIND ALL bridge-only web UIs to the
tailscale IP. Evidence (file:line):
`.planning/harness/artifacts/recon-dashboard-product.md:40` (52-row
services table), `:103-127` (ss -tlnp port cross-reference), Q2 section
("show_in_webui is NOT filtered at the repo level" — listServices);
`.planning/harness/artifacts/recon-compose-map.md:5` (nexusgate
100.68.46.47), `:18`/`:29` and sibling "Edited ports" stanzas (022a's
binding prescriptions).
DIRECTIVE INTERPRETATION (operator-context, binding): "no subdomains"
targets per-app names (the XYZ.cortex.local complaint); the host's own
MagicDNS root for the dashboard itself is compliant (022b exception).

## File ownership
- 022a: HOST-LEVEL ONLY — exactly the compose/service files quoted in
  `.planning/harness/artifacts/recon-compose-map.md` (one ports-stanza
  edit each); NO git commits; every edit quoted verbatim in the report.
- 022b: packages/dashboard-next/migrations/NNN_apps_webui_urls.sql (new),
  src/server/db/repos/services.ts, src/lib/api/services.functions.ts
  (the listServices server-fn — hasWebui must be added to its zod input
  schema and forwarded to the repo), src/lib/api/client.ts (the
  api.services call), src/server/db/repos/__tests__/services* (test),
  and NOTHING else. Report: artifacts/impl-mp-022-report.md (never
  committed).

## 022a (host rebinds; kimi executes the EXACT per-service stanza edits
## prescribed in recon-compose-map.md — binding input; orchestrator
## verifies each):
For each bridge-only web UI — Prometheus 9090, cAdvisor 8081, Obot 8090,
Dockhand 3420, Hermes WebUI 18787 (container 8787;
/opt/cortexos/hermes-webui/docker-compose.yml — the 9119 hermes-dashboard
row is a SEPARATE systemd component, handled per its own recon entry),
BoxBox 8200, Memory OS 6333, Loki 3100 (v6-only → add v4) — apply the
recon-quoted edited ports stanza so the port publishes on 100.109.20.9, `docker compose up -d` (or systemctl restart)
that ONE service, verify `ss -tlnp | grep ':PORT'` shows 100.109.20.9
and `curl -fsS -o /dev/null -w '%{http_code}' http://100.109.20.9:PORT/`
→ 2xx/3xx. ONE service at a time; STOP on any service that fails to come
back (restart it with original config, report IMPL-BLOCKED for that
item). These configs are host-level (untracked stacks/) — no git commit;
record every edit verbatim in the report.

## 022b (repo + DB; kimi) — TDD ORDER:
0. RED first: add a repo test (node-env harness, alongside the existing
   services repo tests) asserting `listServices({ hasWebui: true })`
   returns ONLY rows with has_webui=true — run it: FAILS (option does
   not exist yet); quote the failure.
1. Migration NNN_apps_webui_urls.sql: for every has_webui=true row set
   open_url = 'http://100.109.20.9:PORT/' per the port table (path-only
   rows /hermes/, /files/, /memory/ get their direct ports; NexusGate
   rows get http://<nexusgate-tailscale-ip>:PORT per recon); align
   show_in_webui = has_webui for webui rows (hermes-dashboard t).
   Port map (binding): Grafana 3000, Home Assistant 8123, Jellyfin 8096,
   Prometheus 9090, Loki 3100, pgAdmin 5050, RedisInsight 5540,
   phpMyAdmin 8082, Mongo Express 8083, cAdvisor 8081, Obot 8090,
   9Router 11434, Dockhand 3420, Hermes WebUI 18787, hermes-dashboard
   9119, BoxBox (/files/) 8200, Memory OS (/memory/) 6333;
   NexusGate rows http://100.68.46.47:PORT (LuCI 80, AdGuard 3000).
   DOCUMENTED EXCEPTION (directive-consistent): the Cortex Dashboard row
   keeps https://cortexos.tailfd052e.ts.net — that is the HOST's own
   MagicDNS name on port 443 via Caddy TLS, not a per-app subdomain (the
   directive targets XYZ-per-app names); the dashboard binds
   127.0.0.1:3080 ONLY (PAM/root service behind Caddy), so an
   http://100.109.20.9:3080 URL would not work off-host. Rebinding the
   dashboard is out of scope.
   Idempotent updates; migrations-table insert per repo convention.
2. GREEN: implement hasWebui in the repo (conds push
   eq(services.hasWebui, true)); the RED test passes; /apps (client.ts
   api.services) passes hasWebui: true. /services page unchanged.
3. Apply the migration via scripts/migrate-cli.js (host DB); quote
   applied output + a SELECT of the updated rows.
Gates (binary): tsc exit 0; full suite zero failures ≥578 (577 + the new
RED test); build exit 0; URL battery —
`psql ... -c "SELECT open_url FROM services WHERE has_webui"` then for
EACH url `curl -ksS -o /dev/null -w '%{http_code}' <url>` → every one
2xx/3xx (quote the table; any non-2xx/3xx = FAIL that names the
service); screens = `node packages/dashboard-next/scripts/verify-screens.mjs`
(run from packages/dashboard-next with /opt/cortexos/.secrets/dashboard.env
sourced, via the harness wp-b screen-run job) → script exit 0 AND
PASS 18 / FAIL 0 (orchestrator executes post-deploy).
Commit: feat(dashboard-next): /apps shows only web UIs with working tailscale:port URLs (MP-022)

## Out of scope: deleting service rows; /services page; Caddy config.

## Amendment (post-022a, evidence-driven — logged in GATE-RESOLUTION)
022a discovery: `tailscale serve` already fronts most web-UI ports as
`https://cortexos.tailfd052e.ts.net:PORT` (tailnet-wide TLS, proxy →
localhost). Docker binds on the tailscale IP SHADOW serve (plain-HTTP
collision → TLS "wrong version number"). Corrected architecture (now
live, orchestrator-verified): containers bind 127.0.0.1; serve proxies
every web-UI port; probe matrix green (3000:301, 9090:302, 8081, 5050,
3100, 3420:200, 8123:200, 8096:302, 5540:200, 8082:200, 8083:401-auth,
11434:307, 9119:200, 18787:200, 8200:200, 6333:200; 8090:404-root —
022b adjudicates Obot's real UI path).
022b URL map SUPERSEDED: every webui row's open_url =
`https://cortexos.tailfd052e.ts.net:PORT/` (uniform; the dashboard row
stays the bare host root). NexusGate rows: http://100.68.46.47:PORT
(separate node, unchanged plan). The URL battery (curl every open_url →
2xx/3xx/401) remains the binding gate.
