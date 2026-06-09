# WP-13 — API: Systemd

- **Wave:** 1
- **Depends-on:** WP-01
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-14, WP-15, WP-16, WP-17, WP-18, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/system/systemd.ts` (the bridge, ported here)
  - `packages/dashboard-next/src/routes/api/systemd/`
- **Do NOT touch:** `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, `src/server/policy/` (read-only), any other WP's folder

## Objective

Port the systemd bridge and the two `/api/systemd/*` endpoints. On Linux the bridge calls real `systemctl` via `execFile` (no shell). On non-Linux or `CORTEX_SYSTEMD_BRIDGE_REAL=0` it uses the in-memory `MockUnitExecutor` with 8 seed units. Destructive actions (stop/restart/disable) require an approval token bound to `actionHashFor('systemd.' + action, { name })`. The logs endpoint calls `journalctl` via execFile with a capped line count.

## Read first

- **Legacy bridge (primary source — read fully):**
  - `packages/dashboard/src/lib/server/systemd/bridge.ts` — entire file:
    - `listUnits()`, `getUnit()`, `listLogs()`, `listUnitActions()`
    - `dispatchAction(input, ctx)` — 5-layer defence: policy allowlist → unit name regex → unit lookup + allowlisted flag → destructive approval gate → executor
    - `MockUnitExecutor`, `applyAction()`, `SEED_UNITS` (8 units: caddy, tailscaled, postgresql, redis-server, nginx, docker, unattended-upgrades, cron)
    - `realSystemdExecutor` — uses `systemctl <action> <name>` then `systemctl show <name> --property=...` for post-action state
    - `parseSystemctlShow()`, `getUnitFromSystemctl()`, `listUnitsFromSystemctl()`
    - `UNIT_NAME_RE = /^[A-Za-z0-9_.@-]+$/`
    - `DESTRUCTIVE_ACTIONS`: restart, stop, disable
    - `APPROVAL_TTL_SEC = 60`
- **Legacy API handlers:**
  - `packages/dashboard/src/routes/api/systemd/actions/+server.ts`
  - (logs are served from the systemd page server load; check `packages/dashboard/src/routes/(authed)/systemd/+page.server.ts` for the logs call pattern)
- **Contract section:** `01-API-CONTRACT.md §Systemd (WP-13)`
- **Contracts:** `@cortexos/contracts` — `SystemdUnit`, `SystemdLogLine`, `SystemdActionKind`, `SystemdActiveState`, `SystemdLoadState`

## Steps

1. **Port bridge** — copy `packages/dashboard/src/lib/server/systemd/bridge.ts` to `src/server/system/systemd.ts`. Update imports:
   - `'@cortexos/contracts'` stays
   - `'../audit'` → relative path to `src/server/audit/`
   - `'../approval'` → relative path to `src/server/approval/`
   - `'../policy'` → relative path to `src/server/policy/`
   - `'../entities'` → wherever `User` type lives (WP-01/WP-03)
   - `execFile` from `node:child_process`, `promisify` from `node:util`

   Preserve all exports: `listUnits`, `getUnit`, `listLogs`, `listUnitActions`, `dispatchAction`, `MockUnitExecutor`, `applyAction`, `setExecutorForTests`, `_getMockExecutorForTests`, `_resetSystemdBridgeForTests`, `_SEED_UNITS`, `SystemdUnitSchema`, `SystemdLogLineSchema`.

2. **Add real journalctl logs** — the legacy bridge's `listLogs` only reads the in-memory mock buffer. For the real path (when `currentMock` is null), implement:
   ```ts
   async function listLogsFromJournalctl(name: string, limit: number): Promise<SystemdLogLine[]> {
     const n = Math.max(1, Math.min(limit, 1000));
     try {
       const { stdout } = await execFileAsync('journalctl', ['-u', name, '-n', String(n), '--no-pager', '--output=json'], {
         timeout: 10_000, maxBuffer: 4 * 1024 * 1024,
       });
       return stdout.trim().split('\n')
         .filter(Boolean)
         .map(line => { try { return JSON.parse(line); } catch { return null; } })
         .filter(Boolean)
         .map(entry => ({
           ts: new Date(Number(entry.__REALTIME_TIMESTAMP) / 1000).toISOString(),
           priority: mapPriority(entry.PRIORITY),
           unit: name,
           message: entry.MESSAGE ?? '',
         }));
     } catch { return []; }
   }
   function mapPriority(p: string | undefined): SystemdLogLine['priority'] {
     if (p === '3') return 'err';
     if (p === '4') return 'warn';
     if (p === '7') return 'debug';
     return 'info';
   }
   ```
   Update `listLogs()` to call this when `currentMock` is null.

3. **Declare actions route:**

   `src/routes/api/systemd/actions/index.ts`:
   ```
   POST /api/systemd/actions — auth: admin
   input: { action: SystemdActionKind, unit: string, approvalToken?: string }
   → calls dispatchAction({ action, name: unit, approvalToken? }, ctx), returns {result}
   ```
   Input schema (zod):
   ```ts
   z.object({
     action: z.enum(['start','stop','restart','reload','status','enable','disable','list-units']),
     unit: z.string().min(1).max(256).regex(/^[A-Za-z0-9_.@-]+$/, 'invalid unit name'),
     approvalToken: z.string().optional(),
   })
   ```
   Translate `DispatchResult`:
   - `accepted` → `{ result: { action, name, stdout, stderr, exitCode, unit, durationMs } }`
   - `approval_required` → throw `approvalRequiredError(result.actionHash, result.ttlSec)`
   - `rejected` with unit-not-found codes → `notFoundError`
   - `rejected` with validation codes → `validationError`
   - `rejected` with approval codes → `permissionError`
   - `rejected` with `executor_error` → `systemError`

4. **Declare logs route:**

   `src/routes/api/systemd/$name/logs/index.ts`:
   ```
   GET /api/systemd/:name/logs — auth: any, query: { lines?: number }
   → calls listLogs(name, lines ?? 100), returns {lines: SystemdLogLine[]}
   ```
   Cap `lines` to `[1, 1000]`.

5. **Rate limits:** actions: `rateLimit: { limit: 10, windowSec: 60, bucket: 'user' }`; logs: authed default.

## Acceptance criteria

- [ ] `POST /api/systemd/actions` with `action: 'restart'` and no approval → `approval_required` with `actionHash = actionHashFor('systemd.restart', { name })`
- [ ] `POST /api/systemd/actions` with `action: 'status'` (non-destructive) → succeeds without approval token
- [ ] `POST /api/systemd/actions` with unit name containing `..` → 400 (`unit_name_invalid`)
- [ ] `POST /api/systemd/actions` with `action: 'restart'` against non-allowlisted unit → rejected `not_allowlisted`
- [ ] `GET /api/systemd/caddy.service/logs?lines=20` → returns up to 20 log lines
- [ ] On Linux host, `listUnitsFromSystemctl` populates real units; `listLogsFromJournalctl` returns real journal entries
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# Unit list (via any endpoint that exercises listUnits — use a page or direct adapter call)
# Actions test — expect approval_required
curl -s -X POST http://localhost:3080/api/systemd/actions \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"action":"restart","unit":"caddy.service"}' | jq '{status:.code}'

# Logs
curl -s "http://localhost:3080/api/systemd/caddy.service/logs?lines=5" | jq '.lines|length'

# Linux live check
systemctl list-units --type=service --all --no-pager | head -5
journalctl -u caddy.service -n 5 --no-pager
```

## Notes / gotchas

- **`UNIT_NAME_RE`** — the regex `/^[A-Za-z0-9_.@-]+$/` allows dots and `@` for template unit names like `user@1000.service`. Port this regex verbatim; do not tighten or loosen.
- **Real executor selection** — `process.platform === 'linux' && process.env.CORTEX_SYSTEMD_BRIDGE_REAL !== '0'` → real; otherwise mock. The mock seeds 8 units; `unattended-upgrades.service` has `allowlisted: false` — actions against it must be rejected even if the action is on the policy allowlist.
- **`realSystemdExecutor`** — after `systemctl <action> <name>`, it runs a `systemctl show` to get the updated state. This ensures the response reflects post-action reality, not pre-action state.
- **journalctl JSON output** — `--output=json` emits one JSON object per line. `__REALTIME_TIMESTAMP` is microseconds since epoch (divide by 1000 for milliseconds). `PRIORITY` is a string 0-7 (syslog levels: 3=err, 4=warn, 7=debug).
- **Allowlist check** — the bridge checks `allowlistedCommand('systemd.' + action)` which must match the policy module's `installDefaultAllowlist()` entries. Destructive actions are those with `requiresApproval: true` in the policy: restart, stop. `disable` is in `DESTRUCTIVE_ACTIONS` but check the policy entry.
- **No DB dependency** — this WP does not need WP-02 (no DB queries). Depends only on WP-01.
- **execFile timeout** — `systemctl` action: 30s; `systemctl show`: 10s; `journalctl`: 10s; `list-units`: 5s. Keep these.
