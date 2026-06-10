# WP-12 — API: Incus

- **Wave:** 1
- **Depends-on:** WP-01, WP-02
- **Parallel-safe-with:** WP-10, WP-11, WP-13, WP-14, WP-15, WP-16, WP-17, WP-18, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/incus/`
  - `packages/dashboard-next/src/routes/api/incus/`
- **Do NOT touch:** `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, `src/server/policy/` (read-only), any other WP's folder

## Objective

Port the Incus bridge and all `/api/incus/*` endpoints from the legacy SvelteKit app. On Linux with a real `incus` CLI the bridge calls `incus list --format json` and maps the JSON to `IncusInstance[]` from `@cortexos/contracts`. On non-Linux or when `CORTEX_INCUS_BRIDGE_REAL=0` it uses the in-memory `MockIncusExecutor`. Destructive actions (stop/restart/delete) require an approval token bound to `actionHashFor('incus.' + action, { name })`. The exec-named route enforces a closed allowlist of shell ops (`term.ps`, `term.df`, `term.ls`, `term.cat`, `term.tail_log`, `term.exec_named`) and runs the recursive arg-smuggling scan (PB-4 / T-104 / SR-019).

## Read first

- **Legacy bridge (primary source — read fully):**
  - `packages/dashboard/src/lib/server/incus/bridge.ts` — entire file:
    - `listInstances()`, `getInstance()`, `getMockRecord()`, `listInstanceLogs()`, `listImages()`, `runPreflightReport()`, `buildLaunchProgress()`
    - `dispatchAction(input, ctx)` — 6-layer defence (policy allowlist → name regex → instance lookup → delete confirmation → destructive approval gate → executor)
    - `dispatchExecNamed(name, input, ctx)` — 4-layer defence (instance lookup → op allowlist → arg-smuggling scan → argv_bash_c belt-and-braces → executor)
    - `MockIncusExecutor`, `applyAction()`, `SEED_INSTANCES`, `realIncusExecutor`
    - `mapIncusJsonToMockRecord()` — full mapping from `incus list --format json` output to `MockInstanceRecord`
    - `EXEC_NAMED_OPS` set: `term.ps`, `term.df`, `term.ls`, `term.cat`, `term.tail_log`, `term.exec_named`
    - `INSTANCE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/`
    - `DELETE_CONFIRMATION_PHRASE = 'delete'`
    - `DESTRUCTIVE_ACTIONS`: stop, restart, delete
- **Legacy API handlers:**
  - `packages/dashboard/src/routes/api/incus/instances/+server.ts`
  - `packages/dashboard/src/routes/api/incus/actions/+server.ts`
  - `packages/dashboard/src/routes/api/incus/[name]/exec-named/+server.ts`
  - `packages/dashboard/src/routes/api/incus/[name]/logs/+server.ts`
- **Contracts:** `@cortexos/contracts` — `IncusInstance`, `IncusImage`, `IncusInstanceStatus`, `IncusShellOp`, `IncusPreflightReport`, `IncusPreflightCheck`, `ProgressStep`, `IncusInstanceConfig`
- **Policy allowlist:** `packages/dashboard/src/lib/server/policy/index.ts` — `incus.*` entries
- **Contract section:** `01-API-CONTRACT.md §Incus (WP-12)`

## Steps

1. **Port bridge** — copy `packages/dashboard/src/lib/server/incus/bridge.ts` verbatim to `src/server/incus/bridge.ts`. Update import paths:
   - `'../audit'` → `'../audit'` (relative, same depth)
   - `'../approval'` → `'../approval'`
   - `'../policy'` → `'../policy'`
   - `'../entities'` → `'../auth/entities'` or wherever WP-01 puts the `User` type
   - `'@cortexos/contracts'` stays as-is (workspace package)
   - `execFile` from `node:child_process`, `promisify` from `node:util`

   Preserve all exported symbols: `listInstances`, `getInstance`, `getMockRecord`, `listInstanceLogs`, `listImages`, `listInstanceActions`, `runPreflightReport`, `buildLaunchProgress`, `dispatchAction`, `dispatchExecNamed`, `EXEC_NAMED_OPS`, `DELETE_CONFIRMATION_PHRASE`, `MockIncusExecutor`, `applyAction`, `setExecutorForTests`, `_getMockExecutorForTests`, `_resetIncusBridgeForTests`, `_SEED_INSTANCES`, `_DESTRUCTIVE_ACTIONS`.

2. **Declare instances route:**

   `src/routes/api/incus/instances/index.ts`:
   ```
   GET /api/incus/instances — auth: any → {items: IncusInstance[]}
   ```
   Calls `listInstances()`. No extra filtering; the bridge handles the live-vs-mock switch.

3. **Declare actions route:**

   `src/routes/api/incus/actions/index.ts`:
   ```
   POST /api/incus/actions — auth: admin
   input: { action: IncusActionKind, name: string, confirmation?: string, approvalToken?: string }
   → calls dispatchAction(input, ctx), returns {result}
   ```
   Input schema (zod):
   ```ts
   z.object({
     action: z.enum(['start','stop','restart','delete','launch','list']),
     name: z.string().min(1).max(64),
     confirmation: z.string().optional(),
     approvalToken: z.string().optional(),
   })
   ```
   Handler translates `DispatchResult`:
   - `accepted` → `{ result: { action, name, stdout, stderr, exitCode, instance, durationMs } }`
   - `approval_required` → throw `approvalRequiredError(result.actionHash, result.ttlSec)`
   - `rejected` with code `unknown_instance`/`not_allowlisted` → throw `notFoundError`
   - `rejected` with code `confirmation_required`/`instance_name_invalid`/`unknown_op` → throw `validationError`
   - `rejected` with approval codes → throw `permissionError`
   - `rejected` with `executor_error` → throw `systemError`

4. **Declare exec-named route:**

   `src/routes/api/incus/$name/exec-named/index.ts`:
   ```
   POST /api/incus/:name/exec-named — auth: admin
   input: { op: IncusShellOp, args: Record<string, unknown> }
   → calls dispatchExecNamed(name, input, ctx), returns {argv, status, output}
   ```
   Translate `ExecDispatchResult`: `accepted` → `{ status: 'accepted', op, stdout, stderr, exitCode }`. Rejected codes → appropriate typed errors.

5. **Declare logs route:**

   `src/routes/api/incus/$name/logs/index.ts`:
   ```
   GET /api/incus/:name/logs — auth: any, query: {tail?: number}
   → calls listInstanceLogs(name, tail ?? 100), returns {lines: IncusLogLine[]}
   ```
   Cap `tail` to `[1, 500]`.

6. **Rate limits:** all routes inherit authed default; actions route: `rateLimit: { limit: 10, windowSec: 60, bucket: 'user' }`; exec-named: `rateLimit: { limit: 10, windowSec: 60, bucket: 'user' }`.

## Acceptance criteria

- [ ] `GET /api/incus/instances` returns instances matching `incus list --format json` on live host (or seed on mock)
- [ ] `POST /api/incus/actions` with destructive action and no token → `approval_required` with `actionHash`
- [ ] `POST /api/incus/actions` with `action: 'delete'` and wrong confirmation → rejected `confirmation_required`
- [ ] `POST /api/incus/:name/exec-named` with `op: 'term.ps'` → accepted with stdout
- [ ] `POST /api/incus/:name/exec-named` with `op: 'bash -c id'` → 400 `unknown_op`
- [ ] `GET /api/incus/:name/logs` returns log lines (seed data on mock)
- [ ] Instance name `../etc` → rejected `instance_name_invalid` (INSTANCE_NAME_RE)
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# Live instances (Linux host with incus)
curl -s http://localhost:3080/api/incus/instances | jq '.items|length'

# Attempt destructive without approval
curl -s -X POST http://localhost:3080/api/incus/actions \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"action":"stop","name":"hermes-canary"}' | jq '{status:.code}'

# Exec-named (mock)
curl -s -X POST http://localhost:3080/api/incus/hermes-canary/exec-named \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"op":"term.ps","args":{}}' | jq .status

# Logs
curl -s "http://localhost:3080/api/incus/hermes-canary/logs?tail=10" | jq '.lines|length'
```

## Notes / gotchas

- **Real executor init** — `process.platform === 'linux' && process.env.CORTEX_INCUS_BRIDGE_REAL !== '0'` selects `realIncusExecutor`; all other environments use `MockIncusExecutor` with the 4 SEED_INSTANCES. Never remove this branch.
- **`mapIncusJsonToMockRecord`** — the real `incus list --format json` output embeds `expanded_devices`, `state.network.*`, `config.*` (cpu limits, memory limits, image.name). The mapping function handles all of these; port it verbatim.
- **`getMockRecord` vs `getInstance`** — `dispatchAction` needs `getMockRecord` (returns `MockInstanceRecord` with `allowlisted` flag); UI loaders call `getInstance` (returns clean `IncusInstance`). Both must be exported.
- **PB-4 arg-smuggling** — `dispatchExecNamed` runs the same recursive `validateShellArg` scan and the `argvContainsBashDashC` check that the docker bridge does. Port this verbatim; do not simplify.
- **Delete confirmation** — the typed phrase is `'delete'` (lowercase). The route must pass `input.confirmation` through to `dispatchAction`; the bridge checks it before the approval gate.
- **`incus` CLI timeout** — list: 15s, single lookup: 10s, image list: 15s. Keep these values.
- **Approval token flow** — the bridge calls `verifyApproval` (not `consumeApproval`) for destructive Incus actions. This differs from Docker bridge which calls both. Port exactly as written.
