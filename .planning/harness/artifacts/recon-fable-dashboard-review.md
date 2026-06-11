# Fable full dashboard review — 2026-06-11 (orchestrator first-person)

## CRITICAL-1: client.ts Wave-1 stubs never flipped (10 entries)
src/lib/api/client.ts:875-880 (alerts.rules/history/rulesList/historyList),
:884 (approvals), :887 (audit), :890 (auditList), :905 (agents),
:936 (envFiles) — all `Promise.reject(notYetWired(...))`. Consumers
importing the LIVE client: features/Alerts.tsx:13, Audit.tsx:9,
Approvals.tsx:18, Agents.tsx:28, Healthcheck.tsx:15 (timeline:33 calls
api.alerts.history). Result: those pages' queries REJECT at runtime;
React Query swallows it; screens "PASS" structurally. BACKENDS EXIST:
alerts.functions.ts (:83 listAlertRules, :215 alertHistory),
approvals.functions.ts, agents.functions.ts, audit repos
(db/repos/alerts.ts, audit_events.ts) — tested.

## CRITICAL-2: mock-data engine in production
__root.tsx:20+71 startDrift(queryClient) — fake CPU/network/alert drift.
AppShell.tsx:64 IncidentToaster (components/IncidentToaster.tsx:4 mock
api; doc: "Surfaces newly-created alerts from the drift simulator").
features/Overview.tsx:172 StatusHero (components/StatusHero.tsx:3 mock
api; queryKeys ["services"], ["system"]).
features/Network.tsx:44 NetworkTopology (components/NetworkTopology.tsx:2
mock api.network).
app/CommandPalette.tsx:31-32 — mock api + drift `live()`.

## CRITICAL-3: queryKey collisions (mock vs live fetchers, first-mount wins)
["services"]: StatusHero(mock):20, Apps:130(live), CommandPalette:56(mock),
admin/Services:68(orphan). ["alerts","history"]: IncidentToaster:12(mock)
vs Healthcheck:32(live client). ["network"]: Network.tsx:14(live) vs
NetworkTopology(mock) — same page. ["system"]: StatusHero(mock) vs live
consumers.

## MEDIUM
- Lossy adapters client.ts:448-449 (incus cpu/memory ?? 0), :555 (volume
  size ?? 0) — unknown renders as 0.
- src/features/admin/* — orphaned parallel set (no route mounts; grep
  proved zero usage), still importing mocks.

## HEALTHY (verified)
service_health_log: max(checked_at)=2026-06-11 20:53, 107,184 rows.
Docker actions: callDockerAction + approval minting (Docker.tsx:31-99).
Today's units live: /apps, healthcheck table+tabs, /scheduler, /backups.

## Operator decision (recorded): "Wire live, drop what can't be" —
StatusHero/CommandPalette/IncidentToaster rewired to real data;
NetworkTopology REMOVED until a real source exists; drift deleted.

## ADDENDUM — exact backend map for the nine stubs (orchestrator grep)
- alerts.rules / alerts.rulesList → listAlerts (alerts.functions.ts:91)
- alerts.history / alerts.historyList → alertHistory (alerts.functions.ts:215)
- approvals → listApprovals (approvals.functions.ts:86)
- audit / auditList → listAudit (approvals.functions.ts:367; gate :285)
- agents → listAgents (agents.functions.ts:72)
- envFiles → readEnv (env-browser.functions.ts:175)

## ADDENDUM 2 — live system-metrics source for StatusHero (orchestrator grep)
client.ts:896-900: api.system is WIRED (WP-14) — "Returns live host
metrics: CPU %, memory, drives, mounts, load, uptime, sensors. Calls
getSystem RPC → server/system/readers.collectSystem()." StatusHero's
live rewiring uses api.services (live, WP-10) + api.system (live, WP-14)
from "@/lib/api/client".

## ADDENDUM 3 — adapter consumer cells (orchestrator grep)
Incus.tsx:354 `cell: (r) => `${r.cpu}`` (and the adjacent memory cell)
render the adapter's cpu/memory; Docker.tsx:291 and :328
`cell: (r) => bytes(r.size)` render volume/image size. These are the
exact cells that must render "—" for null after the adapters stop
defaulting to 0 (client.ts:448-449, :555).
