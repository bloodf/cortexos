# Frontend API Client (`src/lib/api/`)

This directory contains the typed `fetch` + TanStack Query client that replaces
the mock seam at `src/mocks/api.ts`. Wave-2 route WPs switch their data source
by changing **one import line** per feature — no call-site changes required.

---

## File layout

```
src/lib/api/
  http.ts       Typed fetch core: CSRF injection, error-envelope parsing, ApiClientError
  auth.ts       login / logout / me  (GET /api/auth/me — the demo acceptance call)
  client.ts     `api` object — same shape as mocks/api.ts; every member is a real fetch
  README.md     This file

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

## The seam swap mechanism

Every sys-pilot feature file that fetches data does so via the `api` object:

```ts
// Current (mock) import:
import { api } from "@/mocks/api";

// Wave-2 replacement (one line change per feature):
import { api } from "@/lib/api/client";
```

The `api` object in `client.ts` exposes **every member** from `mocks/api.ts`
with identical call signatures — `async () => T[]` for simple fetches and
`(p?: ListParams) => Promise<ListResult<T>>` for paginated tables. React Query
cache keys (`["services"]`, `["approvals"]`, etc.) are unchanged because they
live in the feature component, not the client.

**Do NOT modify `src/mocks/api.ts`** — Wave-2 WPs redirect consumers one route
at a time and the mock stays intact as a fallback during the transition.

---

## CSRF handling

The `cortexos_csrf` cookie is **intentionally not HttpOnly** (double-submit
pattern, WP-01/cookies.ts). `http.ts` reads it from `document.cookie` and
injects it as the `x-csrf-token` header on every non-GET request automatically.
Feature code never needs to handle CSRF manually.

---

## Error handling

All non-2xx responses are thrown as `ApiClientError`:

```ts
import { ApiClientError } from "@/lib/api/http";

try {
  const data = await api.services();
} catch (err) {
  if (err instanceof ApiClientError) {
    switch (err.code) {
      case "auth":          // 401 — redirect to login
      case "permission":    // 403 — show "access denied"
      case "approval_required":  // 412 — open approvals flow; use err.action / err.ttlSec
      case "rate_limit":    // 429 — err.retryAfter seconds
      case "validation":    // 400 — err.details has field-level messages
      case "not_found":     // 404
      case "system":        // 500
    }
  }
}
```

TanStack Query surfaces these errors in the standard `error` field:

```ts
const { data, error } = useQuery({
  queryKey: ["services"],
  queryFn: api.services,
  refetchInterval: 3000,
});
if (error instanceof ApiClientError && error.code === "auth") {
  // redirect to login
}
```

---

## Auth client (`auth.ts`)

```ts
import { auth } from "@/lib/api/client";

// Demo acceptance gate (WP-04) — verify this compiles and returns {user,session}:
const session = await auth.me();   // GET /api/auth/me

// Wave-2 login page (WP-30):
await auth.login({ username, password });  // POST /api/auth/login
await auth.logout();                        // POST /api/auth/logout
```

`auth.me()` returns `{user: User, session: Session}` from `@cortexos/contracts`
types and throws `ApiClientError(code="auth", status=401)` when not logged in.

---

## Adapters (`src/lib/adapters/`)

Adapters map `@cortexos/contracts` entity shapes to the sys-pilot component prop
shapes defined in `src/mocks/types.ts`. Use them whenever the real API response
shape differs from what the component expects:

```ts
import { toServiceRow } from "@/lib/adapters";
import type { Service as ContractService } from "@cortexos/contracts/entities";

// In a Wave-2 route component:
const rows = (await api.services()).map(toServiceRow);
```

Adapters are pure functions — no API calls, no side-effects.

---

## Endpoints that return real empty results (no backend yet)

These functions return `[]` / `{rows:[],total:0,...}` until a Wave-1 backend
domain implements them. Wave-2 components should render the existing empty-state
UI — **never fabricate data**.

| `api` member | Reason |
|---|---|
| `users()` / `usersList()` | No `/api/users` in contract (admin page scope TBD) |
| `projects()` / `projectsList()` | No `/api/projects` in contract |
| `notifications()` | Reserved in contract; no route yet |
| `badges()` / `badgesList()` | Badges are embedded in Service entities; no standalone endpoint |
| `backups()` / `backupsList()` | No `/api/backups` in contract |
| `scheduler()` / `schedulerList()` | No `/api/scheduler` in contract |

---

## Function-by-function mapping

| `api` member | HTTP | Path | Contract output | Notes |
|---|---|---|---|---|
| `system()` | GET | `/api/system` | `SystemData` | direct |
| `processes()` | GET | `/api/processes` | `{processes:[]}` | unwraps `.processes` |
| `network()` | GET | `/api/network` | `NetworkData` | direct |
| `services()` | GET | `/api/services` | `{rows,total}` | unwraps `.rows` |
| `servicesList(p)` | GET | `/api/services` | `{rows,total,...}` | paginated |
| `history()` | GET | `/api/services/health-history` | `{snapshots:[]}` | unwraps `.snapshots` |
| `healthcheckList(p)` | GET | `/api/services` | paginated | `activeOnly=true` |
| `docker.containers()` | GET | `/api/docker/containers` | `{items:[]}` | unwraps |
| `docker.images()` | GET | `/api/docker/images` | `{items:[]}` | unwraps |
| `docker.volumes()` | GET | `/api/docker/volumes` | `{items:[]}` | unwraps |
| `docker.containersList(p)` | GET | `/api/docker/containers` | client-side list | |
| `docker.imagesList(p)` | GET | `/api/docker/images` | client-side list | |
| `docker.volumesList(p)` | GET | `/api/docker/volumes` | client-side list | |
| `incus()` | GET | `/api/incus/instances` | `{items:[]}` | unwraps |
| `incusList(p)` | GET | `/api/incus/instances` | client-side list | |
| `systemd()` | GET | `/api/systemd/units` | `{items:[]}` | unwraps |
| `systemdList(p)` | GET | `/api/systemd/units` | client-side list | |
| `alerts.rules()` | GET | `/api/alerts` | `{alerts:[]}` | unwraps |
| `alerts.history()` | GET | `/api/alerts/history` | `{history:[]}` | unwraps |
| `alerts.rulesList(p)` | GET | `/api/alerts` | client-side list | |
| `alerts.historyList(p)` | GET | `/api/alerts/history` | client-side list | |
| `approvals()` | GET | `/api/approvals` | `{pending:[]}` | unwraps |
| `audit()` | GET | `/api/audit` | `{events:[]}` | unwraps |
| `auditList(p)` | GET | `/api/audit` | server/client-side list | |
| `agents()` | GET | `/api/agents` | `{agents:[]}` | unwraps |
| `mail()` | GET | `/api/mail-guardian/reviews` | `{reviews:[]}` | unwraps |
| `mailList(p)` | GET | `/api/mail-guardian/reviews` | server/client-side list | |
| `envFiles()` | GET | `/api/env-browser` | `{entries:[]}` | unwraps; admin-only |
| `drivesList(p)` | GET | `/api/storage` | `{disks:[]}` | client-side list |
| `users()` / `usersList(p)` | — | — | empty | EMPTY-UNTIL-BACKEND |
| `projects()` / `projectsList(p)` | — | — | empty | EMPTY-UNTIL-BACKEND |
| `notifications()` | — | — | empty | EMPTY-UNTIL-BACKEND |
| `badges()` / `badgesList(p)` | — | — | empty | EMPTY-UNTIL-BACKEND |
| `backups()` / `backupsList(p)` | — | — | empty | EMPTY-UNTIL-BACKEND |
| `scheduler()` / `schedulerList(p)` | — | — | empty | EMPTY-UNTIL-BACKEND |
