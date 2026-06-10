# AN-004 — Real logs integration for LogStream

## 1. Current usage: LogStream call sites & expected sources

| File | Line | Context | Expected log source |
|------|------|---------|---------------------|
| `src/features/Healthcheck.tsx` | 85 | "Live log stream" card on the healthcheck page (periodic probes across all registered services). No unit or container context is passed. | **Host journal** — system-wide recent journal, or a core service such as `cortex-dashboard.service`. |
| `src/routes/_authenticated.docker.$id.tsx` | 291 | "Logs" tab inside a single-container detail page. The container object `c` (with `c.id`, `c.name`) is in scope. | **Container logs** — `docker logs --tail N <container-id>` for the specific container being viewed. |
| `src/features/Docker.tsx` | 414 | `DetailDrawer` opened when a container row is clicked (`logsFor: Container`). | **Container logs** — `docker logs --tail N <container-id>` for the selected `logsFor.id`. |

All three sites currently render the same `<LogStream height={…} />` with no data-source prop; the component self-generates synthetic lines via `makeLine()` (Math.random).

---

## 2. Existing server-side log access

### Already implemented (real data + RPC)

- **`src/server/system/systemd.ts:488-529`** — `listLogs(name, limit)`  
  Shells out to `/usr/bin/journalctl --unit <name> -n <limit> --no-pager --output=json`. Parses JSON into `SystemdLogLine[]`. Falls back to in-memory mock data when `currentMock` is set.

- **`src/server/docker/real-data.ts:179-194`** — `tailLogs(id, n)`  
  Shells out to `docker logs --tail <N> <id>`. Returns raw `string[]`. Falls back to stub synthetic lines when `CORTEX_DOCKER_REAL=0`.

- **`src/lib/api/systemd.functions.ts:184-205`** — `unitLogs` server function  
  Exposes `listLogs` via `createServerFn` RPC. `GET`, `auth: "any"`, input validated with Zod (`name` regex `/^[A-Za-z0-9_.@-]+$/`, `limit` clamped `1..500`). Pipeline handles auth, rate-limit, and audit automatically.

### Already implemented (server-only, not yet exposed as RPC)

- **`src/server/docker/real-data.ts`** — the `tailLogs` helper exists but is **not** wired to a `createServerFn`. The only docker RPC is `dockerAction` (`POST`, `auth: "admin"`, approval-gated bridge dispatch in `src/server/docker/bridge.ts`). The bridge allowlist (`src/server/policy/index.ts:268-275`) does include `docker.logs`, but routing read-only log access through the approval-requiring `dockerAction` POST path is heavy and inconsistent with the read-only `unitLogs` pattern.

- **`src/server/terminal/pty-bridge.ts`** — allowlists `term.tail_log` (`journalctl -u <unit> -n <N>`), but this is part of the terminal surface (`auth: "admin"`) and is consumed via `dispatchTerminalOp`, not a lightweight polling endpoint.

- **`src/server/system/readers.ts`** — no host-wide journal reader (no `journalctl` without `--unit`).

---

## 3. Transport constraint & option comparison

### Constraint: ADR-001 (`docs/rebuild/ADR-001-server-transport.md`)

- The ONLY server primitive available is **`createServerFn` RPC** (`@tanstack/react-start@1.168`).
- There is **no working REST route mechanism** (`server.handlers` 404s at runtime).
- There is **no WebSocket / SSE route mechanism** in the framework.
- The PTY sidecar (`:3081`) is the only WS path, but `node-pty` is not yet in the dependency set and the interactive shell is explicitly mocked (see `terminal.functions.ts` WP-19 notes).

### Options

**(a) Polling server-fn**  
Add lightweight `GET` server functions (one for docker logs, optionally one for host-wide journal) that call the existing `tailLogs` / `listLogs` helpers. In the UI, replace the `setInterval(makeLine, …)` inside `LogStream` with a TanStack Query `useQuery({ queryFn, refetchInterval: 3000 })` driven by a `fetcher` prop. This fits ADR-001 exactly; `unitLogs` already proves the pattern end-to-end.

**(b) Routing through the cortex-terminal sidecar WS**  
Would require bolting a log-streaming protocol onto the PTY WebSocket, adding `node-pty` dependency, and bypassing ADR-001’s transport restriction. The terminal surface is also `auth: "admin"`, which is stricter than needed for read-only logs. Over-engineered and architecturally inconsistent.

**(c) Keep mock but label clearly**  
Cheapest (zero files), but explicitly fails the operator requirement for **real** logs.

### Recommendation: (a) — polling server-fn

**Why:** It is the only option that satisfies the real-logs requirement while staying inside the ADR-001 transport boundary. Reuses existing, tested server-side log readers (`tailLogs`, `listLogs`) and the proven `defineServerFn` security pipeline.

### Security notes (citing existing gating)

| Control | How it is enforced | Cited from |
|---------|-------------------|------------|
| **Auth gate** | `auth: "any"` in `defineServerFn` rejects unauthenticated callers with 401 before the handler runs. | `systemd.functions.ts:186`, `system.functions.ts:42` |
| **Arg sanitization** | Zod schema with strict regex (`name` matches `/^[A-Za-z0-9_.@-]+$/`, `limit` clamped `1..500`). Container ID schema should similarly restrict to hex (`/^[a-f0-9]+$/`). `defineServerFn` parses/validates input before the handler; malformed input returns 400. | `systemd.functions.ts:44-53`, `server-fn-pipeline.ts:181-194` |
| **Rate limit** | `rateLimit: { limit: 30, windowSec: 60, bucket: "user" }` (or rely on the authed-default of 10/min). The pipeline tracks per-user sliding windows and returns 429 + `Retry-After`. | `server-fn-pipeline.ts:144-161`, `docker.functions.ts:140` |
| **Audit** | `safeAudit` in the pipeline logs every call (success and failure) with actor, surface, action, and target. Zero extra code required. | `server-fn-pipeline.ts:400-439` |
| **Command injection prevention** | Both `listLogs` and `tailLogs` use `execFile` with a **fixed argv array** (no shell, no string interpolation). The docker bridge allowlist further enforces this for any op that goes through the bridge. | `systemd.ts:495`, `real-data.ts:185` |

---

## 4. Minimal file set (recommended option)

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/api/docker.functions.ts` | **Modified** | Add `containerLogs` GET server function (`createServerFn` + `defineServerFn` gate). Calls existing `tailLogs(id, n)` from `src/server/docker/real-data.ts` via dynamic import. Schema: `id` (hex regex, max 64), `limit` (int, 1..500). Auth: `admin` (container logs can expose application secrets; matches the existing `dockerAction` gating), method: `GET`. STDERR CAVEAT (verified): `tailLogs` captures only CLI stdout (`const { stdout } = await execFileAsync('docker', ['logs', ...])`, real-data.ts:179-194) — but `docker logs` writes the container's stderr stream to the CLI's stderr, so error lines are currently dropped. The micro-plan must either extend `tailLogs` to merge `stdout`+`stderr` (preferred — that is where "real logs" matter most) or explicitly record the limitation as accepted scope. |
| `src/components/LogStream.tsx` | **Modified** | Replace mock interval with a `fetcher: () => Promise<string[]>` prop. Use `useQuery` with `refetchInterval` (e.g. 3000 ms). Keep `paused`, `clear`, `height`, `max` UX. Preserve SSR determinism — binding constraints, not assumptions: (i) this package has NO query dehydration wiring (`grep -RIn 'dehydrate\|HydrationBoundary' packages/dashboard-next/src` → zero matches, established in gated AN-002), so `useQuery` renders its pending state on the server and `data` is undefined on both SSR and first client render — initial markup stays the deterministic empty list; (ii) regardless, the existing hydration regression test `src/components/__tests__/logstream-hydration.test.tsx` (MP-003) MUST stay green and is the binding guard — any micro-plan for this change keeps that test in its acceptance criteria. DATA-SHAPE NOTE (verified): docker `tailLogs(id, n)` already returns `Promise<string[]>` (`src/server/docker/real-data.ts:179`), so its fetcher passes lines through; systemd readers return `SystemdLogLine[]` (`src/server/system/systemd.ts:23`) and the server fns wrap them as `{ unit, limit, count, lines }` (`systemd.functions.ts:200`), so those fetchers MUST map each `SystemdLogLine` to a display string (e.g. `[timestamp] PRIORITY unit: message`) before handing lines to LogStream. |
| `src/routes/_authenticated.docker.$id.tsx` | **Modified** | Pass a `fetcher` to `<LogStream>` that invokes the new `containerLogs` server fn with the route’s `c.id`. |
| `src/features/Docker.tsx` | **Modified** | Pass a `fetcher` to `<LogStream>` that invokes `containerLogs` with `logsFor.id`. |
| `src/server/system/systemd.ts` | **Modified** | Add `listHostLogs(limit)` running `journalctl -n <limit> --no-pager --output=json` WITHOUT `--unit`, returning `SystemdLogLine[]` via the existing parser. |
| `src/lib/api/systemd.functions.ts` | **Modified** | Add `hostLogs` GET server fn exposing `listHostLogs` — same rate-limit/audit pattern as `unitLogs` (:184-205) but with NO `getUnit` precondition, and `auth: "admin"` (NOT "any"): the host-wide journal can carry secrets and service internals; this is a single-admin dashboard, so admin-gating costs nothing and matches the sensitivity. |
| `src/features/Healthcheck.tsx` | **Modified** | Pass a `fetcher` invoking the NEW `hostLogs` fn (mapped to strings per the data-shape note). Do NOT use `unitLogs` with a hardcoded unit name: `unitLogs` throws not-found when `getUnit` misses (`systemd.functions.ts:195-196`), and `cortex-dashboard.service` appears nowhere in the systemd module (reproduce: `grep -n 'cortex-dashboard.service' src/server/system/systemd.ts src/lib/api/systemd.functions.ts` → zero matches). Host-wide journal is also semantically correct for a healthcheck page. |
| `src/components/__tests__/logstream-hydration.test.tsx` | **Modified** | Update assertions: the component still produces deterministic SSR markup (empty lines array), but the mount-only query behavior may change timing; ensure the hydration contract remains pinned. |

### Call-site verification (orchestrator)
LogStream mounts, reproduce with
`grep -rn '<LogStream' packages/dashboard-next/src --include='*.tsx'`:
`src/features/Healthcheck.tsx:85`, `src/routes/_authenticated.docker.$id.tsx:291`,
`src/features/Docker.tsx:414` (verified in-session 2026-06-10).

### Revision note (post-gate)
Gate cycle 1 (critic-analysis-AN-004-real-logs.md-1.md) found the original
§4 recommended `unitLogs` + a hardcoded unit for Healthcheck (runtime-unsafe)
and omitted the SystemdLogLine→string mapping. Both fixed above: `hostLogs`
(formerly the "optional extension") is now the primary Healthcheck source,
and the data-shape note makes the mapping explicit. Docker-side citations
verified by orchestrator: `tailLogs` at `src/server/docker/real-data.ts:179`
returns `Promise<string[]>`.

---

ANALYSIS-COMPLETE
