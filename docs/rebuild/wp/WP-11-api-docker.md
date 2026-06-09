# WP-11 — API: Docker

- **Wave:** 1
- **Depends-on:** WP-01, WP-02
- **Parallel-safe-with:** WP-10, WP-12, WP-13, WP-14, WP-15, WP-16, WP-17, WP-18, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/docker/`
  - `packages/dashboard-next/src/routes/api/docker/`
- **Do NOT touch:** `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, `src/server/policy/` (read-only), any other WP's folder

## Objective

Port the Docker bridge and the four `/api/docker/*` endpoints from the legacy SvelteKit app to `packages/dashboard-next`. The port preserves the real-data layer (`docker ps --format json` / `docker image ls --format json` / `docker volume ls --format json`), the image dedup + `<none>` filter, the 3-second in-process cache, and the allowlisted action dispatch (policy + approval + arg-smuggling guards). All three list endpoints return live data from the host Docker daemon. The actions endpoint requires an approval token for destructive ops (stop/restart/rm).

## Read first

- **Legacy bridge and real-data layer:**
  - `packages/dashboard/src/lib/server/docker/bridge.ts` — `dispatch()`, approval gate, arg-smuggling scan, argv rendering, `setExecutorForTests`, `listDockerOps()`
  - `packages/dashboard/src/lib/server/docker/real-data.ts` — `listContainers`, `listImages` (dedup + `<none>` filter), `listVolumes`, `tailLogs`, action wrappers; 3s cache; env flag `CORTEX_DOCKER_REAL`
  - `packages/dashboard/src/lib/server/docker/stub-data.ts` — fallback types (`Container`, `DockerImage`, `DockerVolume`, `ContainerId`)
- **Legacy API handlers:**
  - `packages/dashboard/src/routes/api/docker/containers/+server.ts`
  - `packages/dashboard/src/routes/api/docker/images/+server.ts`
  - `packages/dashboard/src/routes/api/docker/volumes/+server.ts`
  - `packages/dashboard/src/routes/api/docker/actions/+server.ts`
- **Policy allowlist:** `packages/dashboard/src/lib/server/policy/index.ts` — `docker.*` entries; `requiresApproval` is true for `stop`, `restart`, `rm`, `exec`, `privileged`
- **Contract section:** `01-API-CONTRACT.md §Docker (WP-11)`

## Steps

1. **Port bridge** — copy `packages/dashboard/src/lib/server/docker/bridge.ts` to `src/server/docker/bridge.ts`. Update import paths to relative (`../policy`, `../audit`, `../approval`). No logic changes. Preserve `dispatch()`, `listDockerOps()`, `setExecutorForTests`, `_STUB_MARKER`, `_internals`.

2. **Port real-data layer** — copy `packages/dashboard/src/lib/server/docker/real-data.ts` to `src/server/docker/real-data.ts`. Update imports from `./stub-data`. Keep the 3-second cache (`CACHE_MS = 3000`), `loadContainersJson()` using `docker ps -a --format json` (line-delimited JSON, Docker 25.0+), `loadImagesJson()` with the dedup logic:

   ```ts
   // Deduplicate by repo:tag; drop dangling images where repo === '<none>' or tag === '<none>'
   if (!repo || repo === '<none>' || !tag || tag === '<none>') continue;
   const key = `${repo}:${tag}`;
   if (seen.has(key)) continue;
   seen.add(key);
   ```

   Keep `loadVolumesJson()`, `invalidateCache()`, and all action wrappers (`startContainer`, `stopContainer`, `restartContainer`, `removeContainer`).

3. **Port stub-data types** — copy `packages/dashboard/src/lib/server/docker/stub-data.ts` to `src/server/docker/stub-data.ts` for the type definitions (`Container`, `DockerImage`, `DockerVolume`, `ContainerId`, `asContainerId`). The real-data module imports types from it.

4. **Declare list routes:**

   `src/routes/api/docker/containers/index.ts`:
   ```
   GET /api/docker/containers — auth: any → {items: Container[]}
   ```
   Calls `listContainers()` from `src/server/docker/real-data.ts`.

   `src/routes/api/docker/images/index.ts`:
   ```
   GET /api/docker/images — auth: any → {items: DockerImage[]}
   ```
   Calls `listImages()`. Dedup + `<none>` filter is in real-data layer — no extra logic here.

   `src/routes/api/docker/volumes/index.ts`:
   ```
   GET /api/docker/volumes — auth: any → {items: DockerVolume[]}
   ```
   Calls `listVolumes()`.

5. **Declare actions route:**

   `src/routes/api/docker/actions/index.ts`:
   ```
   POST /api/docker/actions — auth: admin, approval required for destructive ops
   input: { op: string, args: Record<string, unknown>, approvalToken?: string }
   → calls bridge.dispatch(input, ctx), returns {result}
   ```

   Input schema (zod):
   ```ts
   z.object({
     op: z.string().min(1).max(64),
     args: z.record(z.string(), z.unknown()).default({}),
     approvalToken: z.string().optional(),
   })
   ```

   Handler logic:
   - Verify `op` is on allowlist via `allowlistedCommand(op)` — throw `validationError` if not
   - Call `bridge.dispatch({ op, args, approvalToken, sessionId: ctx.session.id }, dispatchCtx)`
   - If `result.status === 'rejected'` → throw `validationError` or `permissionError` based on `result.code`
   - If `result.status === 'accepted'` → return `{ result: { op, argv: result.argv, output: result.output, durationMs: result.durationMs } }`
   - The `defineApiRoute` wrapper's `approval: true` field is NOT used here because the bridge consumes the token internally (it needs the action-hash binding); pass `approvalToken` through `input` instead

6. **Rate limits:** list endpoints inherit authed default (10/min); actions route: `rateLimit: { limit: 10, windowSec: 60, bucket: 'user' }`.

## Acceptance criteria

- [ ] `GET /api/docker/containers` returns live containers from `docker ps -a`; state field is one of running/exited/paused/restarting/created
- [ ] `GET /api/docker/images` returns deduplicated images with `<none>` rows dropped
- [ ] `GET /api/docker/volumes` returns volumes from `docker volume ls`
- [ ] `POST /api/docker/actions` with `op: 'docker.stop'` and no approval token → bridge returns `rejected.missing_approval` → route returns HTTP error (or surfaces approval_required)
- [ ] `POST /api/docker/actions` with non-allowlisted op → 400
- [ ] No real Docker calls when `CORTEX_DOCKER_REAL=0` (falls back to stub)
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
# Typecheck
pnpm --filter @cortexos/dashboard-next typecheck

# Live containers (requires Docker on host)
curl -s http://localhost:3080/api/docker/containers | jq '{count:.items|length}'

# Images — verify no <none> repos
curl -s http://localhost:3080/api/docker/images | jq '[.items[] | select(.repo == "<none>")] | length'
# expect 0

# Volumes
curl -s http://localhost:3080/api/docker/volumes | jq '.items|length'

# Action without approval (expect rejection)
curl -s -X POST http://localhost:3080/api/docker/actions \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"op":"docker.stop","args":{"container":"mycontainer"}}' | jq .
```

## Notes / gotchas

- **Dedup logic is critical** — `docker image ls --format json` emits line-delimited JSON (one JSON object per line, not a JSON array). Parse line-by-line with `JSON.parse(line)`. The dedup `Set<string>` keyed by `${repo}:${tag}` is the source of truth; keep it verbatim from `real-data.ts`.
- **`<none>` filter** — drop any image where `repo === '<none>'` OR `tag === '<none>'` before adding to output. Legacy comment: "Drop dangling images — these have no meaningful reference."
- **Bridge executor** — on Linux without `CORTEX_DOCKER_BRIDGE_REAL=0` the real `docker` CLI is invoked via `execFile` (no shell). On macOS/Windows or with `CORTEX_DOCKER_BRIDGE_REAL=0` the stub executor is used. Keep this env-flag logic.
- **Approval tokens** — the bridge verifies + consumes the token internally using `verifyApproval` / `consumeApproval` from `src/server/approval/`. The route does not call `defineApiRoute`'s `approval: true` field — the bridge owns the consume step.
- **Cache invalidation** — `startContainer`, `stopContainer`, `restartContainer`, `removeContainer` all call `invalidateCache()` after the real execFile call so the next list reflects the new state.
- **execFile timeout** — action calls: 30s; list calls: 10s; maxBuffer: 4 MB. Keep these values.
- **Phantom deps** — import `execFile` from `node:child_process`, `promisify` from `node:util`. Do not add new dependencies.
