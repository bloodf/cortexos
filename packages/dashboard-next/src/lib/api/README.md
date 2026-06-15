# Frontend API Client (`src/lib/api/`)

Transport = **typed `createServerFn` RPC** (ADR-001). There are NO `/api/*` fetch calls.
Each `api` member calls a server function directly; TanStack handles the client↔server bridge.

Routes import the typed `api` object directly:

```ts
import { api } from "@/lib/api/client";
```

---

## File layout

```
src/lib/api/
  client.ts               `api` object — typed RPC surface; calls server fns (RPC)
  auth.ts                 login / logout / me  (TODO WP-20 stubs)
  http.ts                 ApiClientError / ApiErrorCode / ApiErrorEnvelope types (no fetch)
  define-server-fn.ts     defineServerFn() — security-gate middleware factory (WP-01)
  server-fn-runner.server.ts  server-only bridge to defineApiRoute pipeline
  services.functions.ts   WP-10 — services + health server fns (WIRED)
  alerts.functions.ts     WP-17 — alert rules + history server fns (WIRED)
  README.md               This file

src/lib/adapters/
  services.ts   ContractService      → MockService / MockServiceCheck
  incus.ts      ContractLiveInstance → MockIncusInstance
  audit.ts      ContractAuditEvent   → MockAuditEntry
  approvals.ts  ContractApprovalRequest → MockApprovalRequest
  users.ts      ContractUser         → MockPamUser
  mail.ts       ContractMailReview   → MockMailReview
  alerts.ts     ContractAlertRule / ContractAlertEvent → MockAlertRule / MockAlertHistory
  index.ts      Barrel re-export
```

---

## Wired vs TODO surface

| `api` member | Status | Wave-1 WP |
|---|---|---|
| `services()` | **WIRED** | WP-10 |
| `servicesList(p)` | **WIRED** | WP-10 |
| `healthcheckList(p)` | **WIRED** | WP-10 |
| `history()` | returns `[]` (no server-side all-services history) | WP-10 |
| `system()` | TODO — throws "not yet wired" | WP-14 |
| `processes()` | TODO | WP-14 |
| `network()` | TODO | WP-14 |
| `drivesList(p)` | TODO | WP-14 |
| `docker.*` | TODO | WP-11 |
| `incus()` / `incusList(p)` | TODO | WP-12 |
| `systemd()` / `systemdList(p)` | **WIRED** | WP-13 |
| `alerts.*` | **WIRED** | WP-17 |
| `approvals()` | TODO | WP-16 |
| `audit()` / `auditList(p)` | TODO | WP-16 |
| `agents()` | TODO | WP-21 |
| `mail()` / `mailList(p)` | TODO | WP-15 |
| `envFiles()` | TODO | WP-18 |
| `users()` / `usersList(p)` | EMPTY — no contract scope yet | — |
| `projects()` / `projectsList(p)` | EMPTY — no contract scope yet | — |
| `notifications()` | EMPTY — reserved, no server fn yet | — |
| `badges()` / `badgesList(p)` | EMPTY — embedded in Service entities | — |
| `backups()` / `backupsList(p)` | EMPTY — no contract scope yet | — |
| `scheduler()` / `schedulerList(p)` | EMPTY — no contract scope yet | — |

**WIRED** = calls real server function, maps through adapter.  
**TODO** = throws `[WP-04 TODO] ... not yet wired` at runtime; Wave-1 WP must implement.  
**EMPTY** = returns `[]` / `{rows:[],total:0,...}`; no server fn planned for this wave.

---

## How wired domains work (services example)

```ts
// client.ts internally does:
import { listServices as _listServices } from "./services.functions";
import { toServiceRow } from "@/lib/adapters/services";

// api.services() →
const { rows } = await listServicesFn({ data: { activeOnly: true, pageSize: 500 } });
return rows.map(toServiceRow);
```

The `toServiceRow` adapter maps `@cortexos/contracts` entity shapes to the sys-pilot
mock prop shapes defined in `src/mocks/types.ts`. Components see no difference.

---

## Wiring a new domain (Wave-1 WP authors)

When a Wave-1 WP lands its `<domain>.functions.ts`, update `client.ts`:

1. Import the server fn: `import { listFoo as _listFoo } from "./foo.functions"`.
2. Add a typed cast wrapper (the gate-middleware pattern means TypeScript can't pierce
   the middleware boundary — cast `as unknown as (opts: {...}) => Promise<{...}>`).
3. Replace the `notYetWired("foo")` stub with the real call + adapter mapping.
4. Remove the `TODO WP-XX` comment from the `api` member.

---

## Direct server fn access for Wave-2

For operations beyond the flat `api` surface (create, patch, delete, per-service health):

```ts
import { listServices, listServiceHealth } from "@/lib/api/client";

// In a loader/mutation:
const health = await listServiceHealth({ data: { id: serviceId, limit: 50 } });
```

These are the raw server fns re-exported directly; call them typed from loaders/components.

---

## Error handling

The gate pipeline throws typed error envelopes. Catch `ApiClientError` for typed access:

```ts
import { ApiClientError } from "@/lib/api/http";

try {
  await api.services();
} catch (err) {
  if (err instanceof ApiClientError) {
    switch (err.code) {
      case "auth":               // 401 — redirect to login
      case "permission":         // 403 — access denied
      case "approval_required":  // 412 — err.action / err.ttlSec
      case "rate_limit":         // 429 — err.retryAfter seconds
      case "validation":         // 400 — err.details has field messages
      case "not_found":          // 404
      case "system":             // 500
    }
  }
}
```

---

## Auth client (`auth.ts`) — TODO WP-20

```ts
import { auth } from "@/lib/api/client";

// All three throw "not yet wired" until WP-20 provides auth.functions.ts:
await auth.me();
await auth.login({ username, password });
await auth.logout();
```

When WP-20 lands: import the server fns into `auth.ts` and replace the stubs.
