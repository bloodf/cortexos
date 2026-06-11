# MP-022 — /apps: webui-only listing, working tailscale:port URLs

Operator directives (2026-06-11, recorded): only show apps with a web UI;
every web UI reachable as tailscale-IP:port (http://100.109.20.9:PORT) —
no subdomains, no subfolders; REBIND ALL bridge-only web UIs to the
tailscale IP. Evidence: recon-dashboard-product.md (services table rows,
ss -tlnp port table, apps page logic — listServices has NO webui filter).

## 022a (host rebinds; kimi with exact per-service prescriptions from
## recon-compose-map, orchestrator verifies each):
For each bridge-only web UI — Prometheus 9090, cAdvisor 8081, Obot 8090,
Dockhand 3420, Hermes WebUI, BoxBox 8200, Memory OS 6333, Loki 3100
(v6-only → add v4) — edit its compose/service config so the port
publishes on 100.109.20.9, `docker compose up -d` (or systemctl restart)
that ONE service, verify `ss -tlnp | grep ':PORT'` shows 100.109.20.9
and `curl -fsS -o /dev/null -w '%{http_code}' http://100.109.20.9:PORT/`
→ 2xx/3xx. ONE service at a time; STOP on any service that fails to come
back (restart it with original config, report IMPL-BLOCKED for that
item). These configs are host-level (untracked stacks/) — no git commit;
record every edit verbatim in the report.

## 022b (repo + DB; kimi):
1. Migration NNN_apps_webui_urls.sql: for every has_webui=true row set
   open_url = 'http://100.109.20.9:PORT/' per the port table (path-only
   rows /hermes/, /files/, /memory/ get their direct ports; NexusGate
   rows get http://<nexusgate-tailscale-ip>:PORT per recon); align
   show_in_webui = has_webui for webui rows (hermes-dashboard t).
   Idempotent updates; migrations-table insert per repo convention.
2. Repo filter: listServices gains hasWebui?: boolean (conds push
   eq(services.hasWebui, true)); /apps (client.ts api.services) passes
   hasWebui: true. /services page behavior unchanged.
3. Apply the migration via scripts/migrate-cli.js (host DB).
Gates: tsc 0; full suite (≥577) zero failures; build; after deploy the
orchestrator curls EVERY /apps open_url → 2xx/3xx; screens.
Commit: feat(dashboard-next): /apps shows only web UIs with working tailscale:port URLs (MP-022)

## Out of scope: deleting service rows; /services page; Caddy config.
