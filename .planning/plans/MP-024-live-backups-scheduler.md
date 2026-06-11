# MP-024 — wire /backups and /scheduler to live data (currently MOCK)

Evidence: recon-dashboard-product.md Q4 wiring table — both routes
import "@/mocks/api" (static seed): _authenticated.backups.tsx:32,
_authenticated.scheduler.tsx:21. Host-exec pattern (binding precedent):
src/server/system/systemd.ts:30 (`import { execFile } from
"node:child_process"`), :291 ("Real executor (Linux only) — execFile
with fixed argv, no shell"), :15 (NEVER `bash -c <string>` argv).

## File ownership (per unit; NOTHING else)
- 024a: src/server/scheduler/ (NEW: index.ts + __tests__/),
  src/lib/api/scheduler.functions.ts (NEW),
  src/routes/_authenticated.scheduler.tsx, src/lib/api/client.ts (the
  one accessor), i18n keys if the page adds labels
  (src/i18n/{en,es,ptBR}.ts). Report: artifacts/impl-mp-024-report.md
  (never committed).
- 024b: src/server/backups/ (NEW: index.ts + __tests__/),
  src/lib/api/backups.functions.ts (NEW),
  src/routes/_authenticated.backups.tsx, src/lib/api/client.ts (the one
  accessor), i18n keys as above.

## Out of scope
- The mocks/ directory (mock files stay for other consumers; ONLY the
  two routes' imports are removed); backup script behavior; systemd
  timer definitions; any other route; eslint/prettier configs; new
  dependencies.

Tasks (kimi; one route at a time, each with its own commit) — TDD ORDER:
1. /scheduler → LIVE (024a):
   RED (both assertions BEFORE any implementation): (i)
   src/server/scheduler/__tests__/scheduler.test.ts (node-env harness
   like the systemd domain's tests): with a MOCK executor returning
   canned `systemctl list-timers --all --output=json` output,
   listTimers() returns parsed rows (name, schedule, next run, last run,
   unit state) — FAILS (module absent); (ii) the UI component test
   (healthcheck-tabs pattern) mounting the page with a mocked query of 3
   canned timer rows asserting all 3 render — FAILS (page still
   mock-wired). Quote both failures.
   GREEN: implement src/server/scheduler/index.ts using execFile with
   FIXED argv per the systemd.ts:291 pattern (mock/real executor seam
   like systemd.ts:50); server-fn listSchedulerJobs (GET, auth any,
   surface scheduler, action scheduler.list) in scheduler.functions.ts;
   route consumes it via a client.ts accessor; mock import removed from
   _authenticated.scheduler.tsx (binary: `grep -c 'mocks/api'
   src/routes/_authenticated.scheduler.tsx` → 0). Split checkpoints:
   RED (i) goes green after the domain lands; RED (ii) goes green after
   the route wiring — quote both transitions. Post-deploy, the screen
   run binarily fails any 4xx/5xx server-fn response on the route —
   capability evidenced at scripts/verify-screens.mjs:150-184
   (failedRequests/badResponses collection, `HTTP ${status}` push) and
   empirically by run 16's /apps D-001 (a 429 server-fn response flagged
   as FAIL).
   Commit: feat(dashboard-next): /scheduler live from systemd timers (MP-024a)
2. /backups → LIVE (024b): FIXED ROW CONTRACT (binding, defined here —
   the recon maps the discovered source INTO it):
   `{ id: string; timestamp: string (ISO-8601); target: string;
     sizeBytes: number | null; status: 'success'|'failed'|'running'|'unknown' }`.
   Mini-recon FIRST (in-report): inspect what cortex-backup/
   cortex-auto-update write (journalctl -u cortex-backup, BACKUP_ROOT
   contents /mnt/hdd/backups, marker/log files) and quote; document the
   source→contract field mapping explicitly.
   RED: src/server/backups/__tests__/backups.test.ts with EXACT canned
   fixtures in the discovered format (quoted in the test) asserting
   listBackupRuns() returns the mapped contract rows — FAILS; quote.
   UI BINARY: same split-checkpoint pattern as 024a — the UI component
   test (3 mocked contract rows render) is part of RED, goes green after
   the route wiring; the screen run's server-fn 4xx/5xx check
   (verify-screens.mjs:150-184) covers /backups post-deploy.
   GREEN: src/server/backups/index.ts reading the discovered source
   (execFile fixed-argv if shelling out; direct fs reads preferred);
   server-fn + route wiring; mock import removed (binary: `grep -c
   'mocks/api' src/routes/_authenticated.backups.tsx` → 0). If the
   backup state source is genuinely insufficient for a truthful page,
   IMPL-BLOCKED with the evidence and a proposal.
   Commit: feat(dashboard-next): /backups live from backup run state (MP-024b)

## Gates per commit (binary, quote each)
- `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` → exit 0
- `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run'`
  → zero failures, total strictly greater than the prior total (the new
  domain tests add to 582+).
- `pnpm --filter @cortexos/dashboard-next build` → exit 0
- `pnpm run format:check 2>&1 | tail -1` → exit 0
- The mock-import grep FOR THAT UNIT'S ROUTE ONLY → 0 (024a: the
  scheduler.tsx grep; 024b: the backups.tsx grep — each unit's gate
  covers exactly its own route).
- Screens (orchestrator, post-deploy):
  `node packages/dashboard-next/scripts/verify-screens.mjs` via the
  harness wp-b job → exit 0 AND PASS 18 / FAIL 0.
