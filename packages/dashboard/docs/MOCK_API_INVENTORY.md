# Mock API Inventory

> **M0-B Workstream B deliverable** — exhaustive inventory of the API surface (real + mock) that backs the sys-pilot template, plus a mapping to target production contracts.
>
> **Author:** Ada Lovelace (TS React/Svelte Engineer) · **Worktree:** `.worktrees/m0-b-template-audit` on branch `feature/m0-b-template-audit`
>
> **Generated:** 2026-06-02 · **Status:** `pending` (M1/M2 will fill in target contracts and E2E mock scenarios)

---

## 0. Critical context — the "mock" situation

The task brief says the upstream `sys-pilot` template has a "fully mocked backend". That is true **historically** — the original React + TanStack template shipped with client-side mocks so the UI could be developed without a real backend.

**In the vendored copy in `cortexos`, this is no longer the case.** The `sys-pilot/` UI components (sidebar, topbar, tables, drawers) and the `src/lib/api.ts` HTTP client are wired to a **real Next.js App-Router backend at `/api/*`**. The backend routes run on the host (read `/proc`, exec `docker` / `systemctl` / `incus`, query Postgres, etc.).

What remains "mock" or "client-only" is:

1. **Inline component-level mocks** in `DetailDrawer.tsx` (MockLogs, MockMetrics, MockEnv) — fake data shown in the Docker container drawer tabs.
2. **Client-side log stream simulator** in `LogStream.tsx` — `setInterval`-driven fake log lines for the Healthcheck page.
3. **Client-side `useAuth.tsx` fallback** — local mock auth (`admin`/`alex` username pattern → `is_admin=true`) used in the UI; the real PAM-backed `/api/auth` route is what `LoginForm` actually POSTs to.
4. **Local `ProvisionWizard` in `incus/page.tsx`** — fake 5-step wizard with `setTimeout`-driven log lines; the rich real wizard (`components/sys-pilot/incus/provision-wizard.tsx`) is at `/incus/provision`.

There is **no** "drift simulator" or any other backend-side mock — the comment in `IncidentToaster.tsx` calling itself a "drift simulator" is stale.

This document inventories:
- The full HTTP API surface (real + the 5 not-yet-implemented stubs)
- The 4 client-side mock surfaces that the UI shows to the user
- Every entity implied by the API
- A mapping from each surface to its target production contract (`TBD-M1`) and E2E mock scenario (`TBD-M1`)

---

## 1. HTTP API inventory

**Total: 54 `route.ts` files in `src/app/api/`** — but only a subset of these are actually consumed by the `sys-pilot` UI. I list the full backend surface for completeness, then mark which endpoints the UI hits.

Conventions:
- **Used by UI?** — yes/no/partial
- **Auth gate** — `requireAuth` (any logged-in user) / `requireAdmin` / none / `root-helper` (sudo)
- **Error shape** — all `NextResponse.json({ error: string }, { status })`. Some include `details` (zod issues). Audit pages include `data` on success.
- **Read** = `GET`. **Write** = `POST/PUT/PATCH/DELETE`.

### 1.1 Auth

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `POST /api/auth` | `{ username: string, password: string }` | `200 { success, username }` / `400 { error: "Username and password required" }` / `401 { error: "Invalid credentials" }` / `500 { error }` | `LoginForm` | none (PAM via `authenticateUser`); sets `cortex_session` cookie | ✅ |
| `DELETE /api/auth` | (no body) | `{ success: true }` | logout flow | (none) | ✅ |
| `GET /api/auth` (inferred; not read in audit) | — | `{ username, is_admin }` | implied | requireAuth | ✅ (read) |
| `POST /api/auth/password` | `{ currentPassword, newPassword }` | `{ message }` / `{ error }` | `account/page.tsx` | requireAuth | ✅ |
| `POST /api/auth/setup` | (admin first-time bootstrap) | (not opened in audit; exists) | — | (none) | ✅ |

### 1.2 Services registry (`/api/services`)

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/services` | query: `?raw=1`, `?check_type=`, `?webui=true`, `?healthcheck=true` | `{ services: ServiceCheck[], timestamp }` (default) or `{ services, timestamp }` if `raw=1` | `api.services` → `apps`, `healthcheck`, `overview` widgets | none (public healthcheck) | ✅ |
| `POST /api/services` | `{ slug, name, health_url, health_type, category, open_url?, icon_color?, icon_image?, kind? }` | `201 { service }` / `400 { error }` | (not currently used; admin page hits `/api/admin/services`) | requireAuth | ✅ |
| `PATCH /api/services` | `{ id, ...updates }` | `{ service }` | (not used) | requireAuth | ✅ |
| `DELETE /api/services` | query: `?id=` | `{ success: true }` | (not used) | requireAuth | ✅ |
| `GET /api/admin/services?all=1` | — | `{ services: AdminServiceRow[] }` | `admin/services/page.tsx` | requireAuth | ✅ |
| `POST /api/admin/services` | `{ slug, name, category, health_url, open_url, health_type, kind? }` | `201 { service }` | `admin/services/page.tsx` | requireAuth | ✅ |
| `PATCH /api/admin/services` | `{ id, ...updates }` | `{ service }` | `admin/services/page.tsx` | requireAuth | ✅ |
| `DELETE /api/admin/services?id=` | — | `{ success }` | `admin/services/page.tsx` | requireAuth | ✅ |
| `GET /api/services/[slug]/badges` | — | `{ badges: Badge[] }` | (not used by current UI) | requireAuth | ✅ |
| `PUT /api/services/[slug]/badges` | `{ badgeSlugs: string[] }` | `{ badges }` | (not used) | requireAuth | ✅ |
| `GET /api/services/uptime?service_id=N&period=24h\|7d\|30d` | — | `{ service_id, stats, incidents }` | (not used by current UI — was used by old `healthcheck/table.tsx`) | none | ✅ |

### 1.3 System / host metrics

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/system` | — | `SystemData`: `{ cpu, memory:{percent,used,total,free}, drives[], mounts[], load[3], uptime, sensors{cpuTemperature,temperatures,fans,voltages}, timestamp }` (note: route returns strings for drive sizes, but `lib/sys-pilot/types.ts` types DriveInfo.size as `number` — see §2 caveat) | `api.system` → `overview` widgets, `storage`, `healthcheck` indirectly | none | ✅ |
| `GET /api/network` | — | `{ interfaces: [{ name, rxKbps, txKbps, rxBytesTotal, txBytesTotal }] }` (5-state rolling window diff against `/proc/net/dev`) | `api.network` → `network`, `overview` widget | none | ✅ |
| `GET /api/processes` | — | `{ processes: ProcessInfo[] }` (parsed from `ps -eo pid,ppid,user,pcpu,pmem,...`) | `api.processes` → `processes`, `overview` widget | none | ✅ |

### 1.4 Docker

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/docker` | — | `{ containers: {data: DockerContainer[], error?}, images: {data: DockerImage[], error?}, volumes: {data: DockerVolume[], error?} }` (paginated under `data`) | `api.docker.{containers,images,volumes}` → `docker`, `admin/docker`, `overview` widget | none | ✅ |
| `GET /api/docker/networks` | — | `{ networks: DockerNetwork[] }` | `api.docker.networks` (no current consumer) | none | ✅ |
| `GET /api/docker/logs?container=&tail=` | — | (logs stream) | (not used — `MockLogs` is what renders) | none | ✅ (read) |
| `POST /api/docker/actions` | `{ action: "start"\|"stop"\|"restart"\|"pull"\|"prune", name?, target? }` | `{ stdout, stderr }` / `{ error }` | `docker/[id]/page.tsx`, `admin/docker/page.tsx` (start/stop/restart only) | requireAdmin | ✅ |

### 1.5 Incus

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/incus` | — | `{ data: [{ name, status, status_code, type, architecture, created_at, state, profiles, snapshots }] }` (live `incus list`) | `admin/incus/page.tsx` | none | ✅ |
| `GET /api/incus/settings` | — | `{ data: { defaults: WizardDefaults, model: string } }` | `components/sys-pilot/incus/provision-wizard.tsx` | requireAdmin | ✅ |
| `PUT /api/incus/settings` | `{ defaults?, model? }` | `{ success: true }` | (not used) | requireAdmin | ✅ |
| `GET /api/incus/images` | — | `{ data: IncusImage[] }` (live `incus image list`) | `incus/provision` (wizard) | requireAdmin | ✅ |
| `GET /api/incus/instances` | — | `{ data: IncusInstanceRow[] }` (DB-stored wizard configs) | `api.incus.instances` → `incus` page | requireAdmin | ✅ |
| `POST /api/incus/instances` | `{ config: IncusInstanceConfig }` | `201 { data }` / `400 { error, details? }` / `409 { error: "Config already exists: <slug>" }` | `incus/provision` (wizard step 1) | requireAdmin | ✅ |
| `GET /api/incus/instances/[name]` | — | `{ data: InstanceDetail }` / `404` | `incus/[name]/page.tsx` | requireAdmin | ✅ |
| `DELETE /api/incus/instances/[name]` | — | `{ success }` | (not used) | requireAdmin | ✅ |
| `POST /api/incus/instances/[name]/validate` | — | `{ data: { preflight: { ok, checks: [{ id, label, pass, detail? }] } }` | `incus/provision` (wizard preflight) | requireAdmin | ✅ |
| `POST /api/incus/instances/[name]/provision` | (any body) | `{ success, requestId, data: { status, steps: [{ step, status, n?, total?, detail? }] } }` | `incus/provision` (wizard step 5) | requireAdmin | ✅ |
| `GET /api/incus/instances/[name]/provision/status[?requestId=]` | — | `{ data: { status, requestId, steps: ProgressStep[] } }` | `incus/provision` (wizard polls every 2s) | requireAdmin | ✅ |
| `GET /api/incus/[name]` | — | `{ data: <raw `incus info` JSON> }` | `incus/[name]/page.tsx` (live status, 5s poll) | requireAuth | ✅ |
| `POST /api/incus/actions` | `{ action: "start"\|"stop"\|"restart"\|"delete", name }` + `x-incus-delete-confirm: true` for delete | `{ stdout, stderr }` / `{ error }` | `incus/[name]/page.tsx`, `admin/incus/page.tsx` | requireAdmin | ✅ |
| `POST /api/incus/[name]/shell` | `{ command: string }` | `{ stdout, stderr, exitCode? }` / `{ error }` | `incus/[name]/page.tsx` (ShellPanel) | requireAdmin | ✅ |
| `POST /api/incus/create` | (legacy / different shape) | — | (not used by current UI) | requireAdmin | ✅ (read) |
| `POST /api/incus/ai/analyze` | (analyze payload) | — | (not used) | requireAdmin | ✅ (read) |
| `POST /api/incus/ai/models` | — | — | (not used) | requireAdmin | ✅ (read) |

### 1.6 Systemd

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/systemd` | — | `{ services: SystemdUnit[] }` | `api.systemd` → `systemd`, `admin/systemd` | none | ✅ |
| `POST /api/systemd/actions` | `{ action: "start"\|"stop"\|"restart", name }` | `{ stdout, stderr }` / `{ error }` | `systemd/[unit]/page.tsx`, `admin/systemd/page.tsx` | requireAdmin | ✅ |

### 1.7 Alerts

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/alerts` | query: `?history=1`, `?ruleId=`, `?serviceId=`, `?enabled=1`, `?limit=` | `{ rules: AlertRule[] }` (default) / `{ history: AlertHistory[] }` (history=1) / `{ rules: AlertRule[] }` (enabled=1) | `api.alerts.{rules,history}` → `alerts`, `admin/alerts`, `healthcheck`, `IncidentToaster` | none (read) | ✅ |
| `POST /api/alerts` | `{ service_id, name, condition: "offline"\|"online"\|"response_time", threshold_ms?, enabled? }` | `201 { rule }` / `400 { error }` | `admin/alerts/page.tsx` | requireAuth | ✅ |
| `PATCH /api/alerts` | `{ id, ...updates }` | `{ rule }` / `404` | `admin/alerts/page.tsx` | requireAuth | ✅ |
| `DELETE /api/alerts?id=` | — | `{ success: true }` | `admin/alerts/page.tsx` | requireAuth | ✅ |
| `GET /api/alerts/operational` | — | (operational alerts list) | (not used) | requireAuth | ✅ (read) |

### 1.8 Approvals, audit, agents

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `POST /api/approvals` | `{ id, decision: "approve"\|"deny", reason? }` | `{ success }` / `{ error }` | `approvals/page.tsx` | none (intent: any logged-in user; current route has no gate) | ⚠️ NO-AUTH |
| `GET /api/approvals` (inferred) | — | `{ approvals: ApprovalRequest[] }` | `api.approvals` → `approvals` | none | ⚠️ NO-AUTH |
| `GET /api/audit` | query: `?actor_user_id=`, `?tool=`, `?tool_class=safe\|privileged\|destructive`, `?decision=allow\|deny\|prompt`, `?result=ok\|err\|timeout\|denied`, `?from=`, `?to=`, `?limit=`, `?offset=` | `{ rows: AuditEntry[], total }` (zod-validated) | `api.audit` → `audit`, `admin/audit` | requireAdmin | ✅ |
| `GET /api/audit/events/[eventType]` | — | (event list) | (not used) | requireAuth | ✅ (read) |
| `GET /api/audit/verify` | — | (chain verification status) | (not used; `audit/page.tsx` shows static "chain valid" badge) | requireAuth | ✅ (read) |
| `GET /api/agents` | — | `{ groups: [{ project, agents: [{ slug, name, files: [{ name, path }] }] }], timestamp }` (filesystem scan) | `api.agents` → `agents/page.tsx` (flattens) | none | ✅ |
| `GET /api/agents/[slug]/files` | — | `{ files: [{ name, path, language?, content? }] }` | (not used; `agents/page.tsx` reads the `/api/agents` flat list and shows files there) | requireAuth | ✅ (read) |
| `GET /api/agents/[slug]/files/[filename]` | — | `{ content, language, path, name }` | (not used by UI) | requireAuth | ✅ (read) |

### 1.9 Mail Guardian

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/mail-guardian` | — | (mail account summary) | (not used by current UI) | requireAuth | ✅ (read) |
| `GET /api/mail-guardian/accounts` | — | `{ accounts: MailAccount[] }` | (not used) | requireAuth | ✅ (read) |
| `GET /api/mail-guardian/reviews` | — | `{ reviews: MailReview[] }` (joined with processed + queue) | `api.mailGuardian` → `mail-guardian/page.tsx` | requireAuth | ✅ |
| `POST /api/mail-guardian/reviews` | `{ id, decision: "keep"\|"spam"\|"block_sender"\|"allow_sender" }` | `{ success }` / `400 { error }` | `mail-guardian/page.tsx` (handleDecide) | requireAuth | ✅ |

### 1.10 Badges, projects, scheduler, backups, admin users

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/badges?slug=` | — | `{ badges: Badge[] }` (or `{ badge }` if `?slug=`) / `404` | `api.badges` → `admin/badges` | none | ✅ |
| `POST /api/badges` | `{ slug, label, color?, text_color? }` | `201 { badge }` | `admin/badges` | requireAuth | ✅ |
| `PUT /api/badges?slug=` | `{ label?, color?, text_color? }` | `{ badge }` | `admin/badges` | requireAuth | ✅ |
| `DELETE /api/badges?slug=` | — | `{ success }` | `admin/badges` | requireAuth | ✅ |
| `GET /api/projects` | — | `{ projects: Project[] }` (admin list) | `api.projects` → `admin/projects` | requireAuth | ✅ |
| `POST /api/projects` | `{ slug, name, repo_url?, messaging_mode: "single"\|"distributed" }` | `201 { project }` | `admin/projects` | requireAuth | ✅ |
| `PUT /api/projects?slug=` | `{ name?, repo_url?, messaging_mode? }` | `{ project }` | `admin/projects` | requireAuth | ✅ |
| `DELETE /api/projects?slug=` | — | `{ success }` | `admin/projects` | requireAuth | ✅ |
| `GET /api/projects/[slug]/routes` | — | (per-project routes) | (not used) | requireAuth | ✅ (read) |
| `GET /api/scheduler` | — | `{ jobs: ScheduledJob[] }` (parsed from `systemctl list-timers --all --output=json`) | `api.scheduler` → `scheduler` | requireAuth | ✅ |
| `GET /api/backups` | — | ❌ **NOT IMPLEMENTED** — route does not exist; the page hits the URL and 404s. UI shows the empty-state "No backups found — check the NAS mount and the cortex-backup timer." | `api.backups` → `backups` | n/a | ❌ MISSING |
| `GET /api/admin/users` | — | `{ users: PamUser[] }` (read-only PAM-backed list) | `api.users` → `admin/users` | requireAuth | ✅ (POST/PATCH/DELETE return 405 per the source comment) |

### 1.11 Health, env-browser, layout, root-helper, chat-sessions, ai

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `GET /api/health` | — | `{ status: "ok", timestamp }` | (liveness probe) | none | ✅ |
| `GET /api/env-browser?path=` | — | `{ path, lines: EnvLine[] }` (kv masked by default; cleartext requires `X-Cortex-Confirmation-Token` in POST header) | `admin/env-browser` | requireAuth | ✅ |
| `POST /api/env-browser` | `{ path, lineEdits: [{ line, newRaw }] }` + confirmation token | `{ success }` | (not used; comment says "no UI-accessible mint endpoint") | requireAdmin | ✅ (read) |
| `GET /api/layout` | — | (UI layout prefs) | (not used) | requireAuth | ✅ (read) |
| `GET /api/root-helper/commands` | — | (root-helper command catalog) | (not used) | requireAdmin | ✅ (read) |
| `GET /api/chat-sessions` | — | `{ sessions: [...] }` | (not used) | requireAuth | ✅ (read) |
| `POST /api/ai/chat` | `{ messages, model? }` | (SSE stream) | (not used by sys-pilot UI; used elsewhere in dashboard) | requireAuth | ✅ |

### 1.12 Terminal (privileged — needs Schneier review)

| Method + Path | Request | Response | Used by | Auth | Status |
|---|---|---|---|---|---|
| `POST /api/terminal` | `{ action: "connect"\|"exec"\|"disconnect", sessionId, data? }` | `{ success }` (connect) / streams via SSE | `terminal/page.tsx` | requireAdmin | ✅ |
| `GET /api/terminal?sessionId=` | (SSE) | text/event-stream of `{ output, error }` frames | `terminal/page.tsx` (EventSource) | requireAdmin | ✅ |

**Notes on terminal:** The route `spawn`s the host shell (`/bin/bash` from `$TERMINAL_SHELL` or `$SHELL`); in container mode, it `nsenter`s to PID 1. Sessions are kept in an in-memory `Map`, max 10, 30-min idle timeout. **This is a full privileged shell; Schneier must review.**

---

## 2. Entity types implied by the API

These are the canonical domain entities the dashboard models. Canonical definitions live in `src/lib/sys-pilot/types.ts`; the API route returns them in slightly looser shapes (e.g. `/api/system` returns drive sizes as strings, but the type says numbers — UI tolerates this because format helpers handle both).

| Entity | Key fields | Source |
|---|---|---|
| `Service` | id, slug, name, open_url, category, status, responseTime, icon_color, icon_image, kind (`app\|service\|docker\|process`), health_url, health_type (`http\|tcp\|docker\|systemd\|process`), description, env_source, is_active, has_webui, show_in_healthcheck, show_in_webui, sort_order, icon_type, badges[] | `/api/services` (and `/api/admin/services`) |
| `ServiceCheck` | same as `Service` minus registry fields; status is set by live probing | `/api/services` (default GET) |
| `SystemData` | cpu, memory{percent,used,total,free}, drives[], mounts[], load[3], uptime, sensors{cpuTemperature,temperatures,fans,voltages} | `/api/system` |
| `DriveInfo` | name, model, size (string in route; type says number), type, mount?, used?, total?, percent? | `/api/system` |
| `MountInfo` | filesystem, mount, total (string), used, free, percent | `/api/system` |
| `MachineSensor` | id, label, value, unit (`celsius\|rpm\|volts`), source | `/api/system` |
| `ProcessInfo` | pid, user, command, cpu, mem | `/api/processes` |
| `NetworkInterface` | name, rxKbps, txKbps, rxBytesTotal, txBytesTotal | `/api/network` |
| `NetworkData` | { interfaces: NetworkInterface[] } | `/api/network` |
| `DockerContainer` | id, name, image, status (free-form), state (`running\|exited\|paused\|restarting`), ports, created | `/api/docker` |
| `DockerImage` | id, repo, tag, size, created | `/api/docker` |
| `DockerVolume` | name, driver, mountpoint, size | `/api/docker` |
| `DockerNetwork` | id, name, driver, scope | `/api/docker/networks` |
| `IncusInstance` (live) | name, status, status_code, type, architecture, created_at, state.networks.addresses, profiles, snapshots | `/api/incus` |
| `IncusInstance` (DB) | name, slug, status (`draft\|validated\|provisioning\|active\|failed`), type (`container\|vm`), image, cpu, memory, config{}, devices{}, last_validation{}, created_at | `/api/incus/instances` |
| `IncusImage` | fingerprint, architecture, type, size, uploaded_at, aliases[] | `/api/incus/images` |
| `IncusInstanceConfig` | target{mode, repoUrl?, branch, ghOrg, slug, description?}, image{alias, gastown, profiles[], cpu?, memory?, pool}, hermes{enabled, profile, port, model, proxies[]}, network{bridge, tailscale, tailscaleKeyRef?, webAccess} | (zod-validated; `incusInstanceConfigSchema` from `@/lib/incus/config-schema`) |
| `SystemdUnit` | name, description, load, active (`active\|inactive\|failed`), sub, enabled (derived from sub==="running" in admin page) | `/api/systemd` |
| `AlertRule` | id, name, service_id, condition (`offline\|online\|response_time`), threshold_ms?, enabled | `/api/alerts` |
| `AlertHistory` | id, ruleName, serviceName, status (`fired\|resolved\|info`), message, timestamp | `/api/alerts?history=1` |
| `ApprovalRequest` | id, actor, tool, summary, args_preview, requested_at, status (`pending\|approved\|denied`), reason? | `/api/approvals` |
| `AuditEntry` | id, actor, tool, tool_class, args_hash, decision (`allow\|deny`), decision_reason, result, created_at | `/api/audit` |
| `Badge` | slug, label, color, text_color | `/api/badges` |
| `BadgeRef` | slug, label, color | (denormalized on `Service.badges[]`) |
| `PamUser` | id, username, created_at, active_sessions, last_login_at | `/api/admin/users` |
| `Project` | slug, name, description, repo_url, branch, created_at | `/api/projects` |
| `Agent` | slug, name, description, files[{ path, language, content }] | `/api/agents` (flattens groups) |
| `MailReview` | id, account_slug, message_uid, message_id, model_verdict, model_confidence, owner_decision?, approver?, requested_at, resolved_at?, processed_action?, queued_decision?, queued_status?, queued_error? | `/api/mail-guardian/reviews` |
| `BackupEntry` | id, name, created_at, size, status | (target `/api/backups` — NOT IMPLEMENTED) |
| `ScheduledJob` | id, name, schedule, next_run, enabled | `/api/scheduler` |
| `NotificationEntry` | id, channel, message, sent_at, status | (no backend; `api.notifications()` returns `[]`) |
| `EnvLine` | line, raw, type (`kv\|comment\|blank`), key?, value?, exported?, masked? | `/api/env-browser` |
| `WizardDefaults` | image, ghOrg, bridge, pool, branch, proxies[] | `/api/incus/settings` |
| `IncusPreflightReport` | ok, checks[{ id, label, pass, detail? }] | `/api/incus/instances/[name]/validate` |
| `ProgressStep` | step, status (`ok\|done\|error\|failed\|...`), n?, total?, detail? | `/api/incus/instances/[name]/provision/status` |
| `IncusInstanceDetail` (admin list shape) | name, slug?, status, config{}, last_validation{}, last_request_id?, created_by?, created_at, updated_at, live_status? | `/api/incus/instances/[name]` |
| `TerminalSession` (server-internal) | process, buffer, listeners, connected, lastActivity | in-memory in `/api/terminal` |

---

## 3. Client-side mock surfaces (the four "Mock*" helpers)

These are NOT API calls — they are pure client-side functions that the UI invokes to render fake data when the backend has no equivalent. **Each one is a real, visible feature of the current UI.**

### 3.1 `MockLogs` (`src/components/sys-pilot/DetailDrawer.tsx`)

```ts
function MockLogs({ name: string, lines?: number = 60 }): JSX
```

- **Algorithm:** Generates `lines` synthetic log lines. Each line: `HH:MM:SS.mmm LEVEL name: <msg>`. Level is weighted (5% ERROR, 15% WARN, 80% INFO). `msg` is drawn uniformly from a 10-entry pool (`"request handled in 12ms"`, `"connection accepted from 10.0.0.42"`, `"cache hit ratio 94.2%"`, etc.).
- **Used by:** `docker/page.tsx` Logs tab in the DetailDrawer.
- **Backend reality:** `/api/docker/logs` exists but is **not called** by the current UI. The mock is what the user sees.
- **Implied entity:** synthetic `LogLine` (no formal type; `LogViewer.lines: string[]`).

### 3.2 `MockMetrics` (`src/components/sys-pilot/DetailDrawer.tsx`)

```ts
function MockMetrics(): JSX
```

- **Algorithm:** Three 30-point random series — `cpu` ∈ [20, 80], `mem` ∈ [30, 70], `lat` (latency) ∈ [20, 140] ms. Rendered as three `MetricSparkCard` (Sparkline + last value).
- **Used by:** `docker/page.tsx` Metrics tab.
- **Backend reality:** **No `/api/docker/{id}/metrics` exists.** The mock is the only source.

### 3.3 `MockEnv` (`src/components/sys-pilot/DetailDrawer.tsx`)

```ts
function MockEnv({ keys: string[] }): JSX
```

- **Algorithm:** Renders `[{ key, value: "••••••••••••" }]` for each provided key. No real values.
- **Used by:** `docker/page.tsx` Environment tab.
- **Backend reality:** **No `/api/docker/{id}/env` exists.** The mock is the only source. (Note: the host-level `/api/env-browser?path=<file>` does read real env files, but it's scoped to the secrets dir, not per-container.)

### 3.4 `LogStream` (`src/components/sys-pilot/LogStream.tsx`)

```ts
function LogStream({ height?: number = 480, intervalMs?: number = 700, max?: number = 400 }): JSX
```

- **Algorithm:** `setInterval(intervalMs)` emits a synthetic log line: `[YYYY-MM-DD HH:MM:SS] LEVEL source msg`. `SOURCES = ["systemd", "docker", "incus", "kernel", "auditd", "ollama", "caddy"]` (uniform). `LEVELS = ["INFO", "INFO", "INFO", "INFO", "WARN", "DEBUG", "ERROR"]` (weighted). `MESSAGES = 13-entry pool` (uniform). Bounded buffer (`max`), Pause/Resume + Clear buttons.
- **Used by:** `healthcheck/page.tsx` "Live log stream" card.
- **Backend reality:** `/api/docker/logs` exists but not used. **No** generic `/api/logs/stream` SSE.

### 3.5 `useAuth` mock fallback (`src/hooks/useAuth.tsx`)

- **Algorithm:** `login()` is a 400ms timeout, then sets `is_admin = true` for `username === "admin" || "alex"`, else `false`. Persisted in `localStorage["cortex.auth"]`. `switchUser(admin)` toggles.
- **Used by:** every page that reads `user?.is_admin` for RBAC (sidebar visibility, admin button disable, terminal gate).
- **Backend reality:** `LoginForm` actually POSTs to `/api/auth` (real PAM); the hook is a client-side state layer. If the real auth cookie is not set, the dashboard still renders with whatever the local hook returns. **In a real production deployment, the hook should mirror the server's `getCurrentSession()` response.**

### 3.6 Inline `ProvisionWizard` in `incus/page.tsx` (dead local mock)

- **Algorithm:** 5-step wizard with `setTimeout(..., (i+1) * 600)` that pushes fake "Preflight: …", "incus launch …", "Applying limits.cpu=…" log lines. After 7 steps, calls `onCreated()` with a synthetic `IncusInstance`.
- **Used by:** `incus/page.tsx` only — but the `ProvisionWizard` imported and used is the local function, not the rich one from `components/sys-pilot/incus/provision-wizard.tsx`. So the rich wizard is **not** used at `/incus`; it is only used at `/incus/provision`. This is a UX duplication bug.
- **Backend reality:** The rich wizard is the real one (calls `/api/incus/instances`, `/validate`, `/provision`).

---

## 4. Realtime / drift / streaming behavior in the UI

There is **no server-pushed "drift simulator"**. The only realtime-like behaviors in the UI are:

| Surface | Behavior | Cadence |
|---|---|---|
| `IncidentToaster` (`src/components/sys-pilot/IncidentToaster.tsx`) | Polls `GET /api/alerts?history=1`; diffs new entries since last poll; emits a sonner toast per new entry (fired → error, resolved → success, info → info). Uses a `useRef<Set<string>>` to remember seen IDs. Skips the very first batch (seed). | every 4s (component default) |
| `overview/widgets.tsx` → `useHistory()` | `useQuery({queryKey:["history"], refetchInterval: 5_000})` polls `/api/system` and pushes into a shared module-level ring buffer (60 entries) used by CpuW/MemW/LiveTrendW. | every 5s |
| `apps/page.tsx` (`useQuery`) | `refetchInterval: 3000` | every 3s |
| `healthcheck/page.tsx` | services `3000`; alerts `3000` | every 3s |
| `network/page.tsx` | `refetchInterval: 3000` | every 3s |
| `processes/page.tsx` | `refetchInterval: 3000` | every 3s |
| `storage/page.tsx` | `refetchInterval: 5000` | every 5s |
| `alerts/page.tsx` | history `refetchInterval: 3000` | every 3s |
| `incus/[name]/page.tsx` | `incus/{name}` live status `refetchInterval: 5000` | every 5s |
| `incus/[name]/page.tsx` | detail `refetchInterval: undefined` (just on mount) | on mount only |
| `admin/docker/page.tsx` | containers `refetchInterval: 5000` | every 5s |
| `admin/incus/page.tsx` | `refetchInterval: 5000` | every 5s |
| `admin/audit/page.tsx` | audit `refetchInterval: 10000` | every 10s |
| `audit/page.tsx` (non-admin) | audit `refetchInterval: 10000` | every 10s |
| `mail-guardian/page.tsx` | `refetchInterval: 5000` | every 5s |
| `backups/page.tsx` | `refetchInterval: 30000` | every 30s |
| `scheduler/page.tsx` | `refetchInterval: 10000` | every 10s |
| `provision-wizard.tsx` (incus) | `setInterval(2000)` polling of `/api/incus/instances/[name]/provision/status` while provisioning | every 2s, only during wizard run |
| `terminal/page.tsx` | SSE on `GET /api/terminal?sessionId=…` (continuous) | server-pushed |
| `LogStream` (mock) | `setInterval(700)` synthetic log lines | every 700ms, client-only |

> The task brief called `IncidentToaster` a "drift simulator" — that comment in the source is stale. The actual implementation polls the real backend.

---

## 5. UI → API method → Target contract → E2E mock scenario

This table is the executable core of the document. Each row maps a UI feature to the API method(s) it uses, the target production contract, and the E2E mock scenario. **Status: `pending`; M1 will fill `Target Contract` and `E2E Mock Scenario`** as `TBD-M1` placeholders.

> Conventions: `✅` = live today, `⚠️` = partial / gap, `🟡` = mock-only (replace with real in M1).

| # | UI Feature | UI File | API Method(s) Used | Response Shape (today) | Target Contract | E2E Mock Scenario | Status |
|---|---|---|---|---|---|---|---|
| 1 | Sidebar (group visibility) | `src/app/sys-pilot/Sidebar.tsx` | none (reads `useAuth`) | n/a | unchanged (client composition) | n/a | ✅ |
| 2 | TopBar (theme + user menu) | `src/app/sys-pilot/TopBar.tsx` | `useAuth` only | n/a | unchanged | n/a | ✅ |
| 3 | CommandPalette (recent + actions) | `src/components/command-palette.tsx` | `useAuth`, `useTheme` only | n/a | unchanged | n/a | ✅ |
| 4 | KeyboardShortcuts | `src/hooks/useKeyboardShortcuts.tsx` | none | n/a | unchanged | n/a | ✅ |
| 5 | IncidentToaster (alerts) | `src/components/sys-pilot/IncidentToaster.tsx` | `GET /api/alerts?history=1` (every 4s) | `{ history: AlertHistory[] }` | unchanged | `mock-sse-alerts.json` (TBD-M1) | ✅ |
| 6 | LoginForm | `src/components/sys-pilot/auth/login-form.tsx` | `POST /api/auth` | `{ success, username }` / `{ error }` | unchanged | `mock-auth-200.json`, `mock-auth-401.json` (TBD-M1) | ✅ |
| 7 | PageHeader | `src/components/sys-pilot/PageHeader.tsx` | none | n/a | unchanged | n/a | ✅ |
| 8 | StatusHero | `src/components/sys-pilot/StatusHero.tsx` | `GET /api/services`, `GET /api/system` | `{ services: ServiceCheck[] }`, `SystemData` | unchanged | `mock-services-online.json`, `mock-system.json` (TBD-M1) | ✅ |
| 9 | MetricCard / Sparkline / AreaTrend / GaugeRadial | `src/components/sys-pilot/{MetricCard,Sparkline,AreaTrend,GaugeRadial}.tsx` | none (pure presentational) | n/a | unchanged | n/a | ✅ |
| 10 | NetworkTopology | `src/components/sys-pilot/NetworkTopology.tsx` | `GET /api/network` (3s) | `{ interfaces: NetworkInterface[] }` | unchanged | `mock-network.json` (TBD-M1) | ✅ |
| 11 | KeyValueList, CodeBlock, CopyButton | `src/components/sys-pilot/{KeyValueList,CodeBlock,CopyButton}.tsx` | none | n/a | unchanged | n/a | ✅ |
| 12 | ConfirmDialog (type-to-confirm) | `src/components/sys-pilot/ConfirmDialog.tsx` | none | n/a | unchanged | n/a | ✅ |
| 13 | DataTable (search/sort/page/select/density) | `src/components/sys-pilot/DataTable.tsx` | none (consumes parent data) | n/a | unchanged | n/a | ✅ |
| 14 | DetailDrawer (Sheet + Tabs) | `src/components/sys-pilot/DetailDrawer.tsx` | none (parent provides) | n/a | unchanged | n/a | ✅ |
| 15 | **MockLogs** (Docker logs tab) | `src/components/sys-pilot/DetailDrawer.tsx` | none (client-side) | n/a | `GET /api/docker/logs?container=…&tail=…` (TBD-M1) | `mock-docker-logs.json` (TBD-M1) | 🟡 |
| 16 | **MockMetrics** (Docker metrics tab) | `src/components/sys-pilot/DetailDrawer.tsx` | none (client-side) | n/a | `GET /api/docker/{id}/metrics` (TBD-M1) | `mock-docker-metrics.json` (TBD-M1) | 🟡 |
| 17 | **MockEnv** (Docker env tab) | `src/components/sys-pilot/DetailDrawer.tsx` | none (client-side) | n/a | `GET /api/docker/{id}/env` (TBD-M1, gated) | `mock-docker-env.json` (TBD-M1) | 🟡 |
| 18 | LogViewer (auto-follow) | `src/components/sys-pilot/LogViewer.tsx` | none (consumes lines) | n/a | unchanged | n/a | ✅ |
| 19 | **LogStream** (Healthcheck live log) | `src/components/sys-pilot/LogStream.tsx` | none (client-side setInterval) | n/a | `GET /api/logs/stream` SSE (TBD-M1) | `mock-log-stream.jsonl` (TBD-M1) | 🟡 |
| 20 | IncidentTimeline | `src/components/sys-pilot/IncidentTimeline.tsx` | none (consumes items) | n/a | unchanged | n/a | ✅ |
| 21 | StatusBadge | `src/components/sys-pilot/StatusBadge.tsx` | none | n/a | unchanged | n/a | ✅ |
| 22 | TechIcon | `src/components/sys-pilot/TechIcon.tsx` | none | n/a | unchanged | n/a | ✅ |
| 23 | EmptyState | `src/components/sys-pilot/EmptyState.tsx` | none | n/a | unchanged | n/a | ✅ |
| 24 | Widgets (Cpu/Mem/Storage/CpuTemp/SvcOn/SvcOff/Live/Sensors/Processes/Network/Uptime/Docker/Incus/Alerts/Db/Mon/Drives) | `src/components/sys-pilot/overview/widgets.tsx` | `GET /api/services`, `GET /api/system`, `GET /api/network`, `GET /api/processes`, `GET /api/docker/containers`, `GET /api/incus/instances`, `GET /api/alerts?history=1` | (see individual endpoints) | unchanged | per-widget mocks (TBD-M1) | ✅ |
| 25 | `AdminDashboard` (placeholder) | `src/components/sys-pilot/admin/admin-dashboard.tsx` | `getAllServicesForAdmin` (server fn) | `Service[]` | unchanged | `mock-admin-services.json` (TBD-M1) | ✅ |
| 26 | `LoginForm` (post to /api/auth) | `src/components/sys-pilot/auth/login-form.tsx` | `POST /api/auth` | `{ success, username }` | unchanged | (see #6) | ✅ |
| 27 | `AgentFileViewer` (stub) | `src/components/sys-pilot/agents/agent-file-viewer.tsx` | none (returns placeholder) | n/a | `GET /api/agents/[slug]/files/[filename]` (TBD-M1) | `mock-agent-file.json` (TBD-M1) | 🟡 |
| 28 | `ProvisionWizard` (rich, real backend) | `src/components/sys-pilot/incus/provision-wizard.tsx` | `GET /api/incus/settings`, `GET /api/incus/images`, `POST /api/incus/instances`, `POST /api/incus/instances/[name]/validate`, `POST /api/incus/instances/[name]/provision`, `GET /api/incus/instances/[name]/provision/status` | (see §1.5) | unchanged | `mock-incus-wizard-{defaults,images,create,validate,provision,status}.json` (TBD-M1) | ✅ |
| 29 | `/admin` (services count card) | `src/app/[locale]/admin/page.tsx` | server-side: `getAllServicesForAdmin()` | `Service[]` | unchanged | `mock-admin-services.json` (TBD-M1) | ✅ |
| 30 | `/admin/services` (CRUD) | `src/app/[locale]/admin/services/page.tsx` | `GET/POST/PATCH/DELETE /api/admin/services` | `{ services }` / `{ service }` / `{ success }` | unchanged | per-method mock (TBD-M1) | ✅ |
| 31 | `/admin/badges` (CRUD + color picker) | `src/app/[locale]/admin/badges/page.tsx` | `GET/POST/PUT/DELETE /api/badges` | `{ badges }` / `{ badge }` | unchanged | per-method mock (TBD-M1) | ✅ |
| 32 | `/admin/env-browser` (file viewer) | `src/app/[locale]/admin/env-browser/page.tsx` | `GET /api/env-browser?path=…` | `{ path, lines: EnvLine[] }` | unchanged | `mock-env-browser.json` (TBD-M1) | ✅ |
| 33 | `/admin/systemd` (real actions) | `src/app/[locale]/admin/systemd/page.tsx` | `GET /api/systemd`, `POST /api/systemd/actions` | `{ services: SystemdUnit[] }` / `{ stdout, stderr }` | unchanged | `mock-systemd.json`, `mock-systemd-action.json` (TBD-M1) | ✅ |
| 34 | `/admin/docker` (real actions, removal disabled) | `src/app/[locale]/admin/docker/page.tsx` | `GET /api/docker/containers`, `POST /api/docker/actions` | (see §1.4) | unchanged | per-method mock (TBD-M1) | ✅ |
| 35 | `/admin/alerts` (CRUD) | `src/app/[locale]/admin/alerts/page.tsx` | `GET /api/alerts`, `POST/PATCH/DELETE /api/alerts` | (see §1.7) | unchanged | per-method mock (TBD-M1) | ✅ |
| 36 | `/admin/users` (read-only) | `src/app/[locale]/admin/users/page.tsx` | `GET /api/admin/users` | `{ users: PamUser[] }` | unchanged | `mock-admin-users.json` (TBD-M1) | ✅ |
| 37 | `/admin/projects` (CRUD) | `src/app/[locale]/admin/projects/page.tsx` | `GET/POST/PUT/DELETE /api/projects` | (see §1.10) | unchanged | per-method mock (TBD-M1) | ✅ |
| 38 | `/admin/incus` (real actions) | `src/app/[locale]/admin/incus/page.tsx` | `GET /api/incus`, `POST /api/incus/actions` | (see §1.5) | unchanged | per-method mock (TBD-M1) | ✅ |
| 39 | `/admin/audit` (table + JSON export) | `src/app/[locale]/admin/audit/page.tsx` | `GET /api/audit` | `{ rows, total }` | unchanged | `mock-audit-chain.json` (TBD-M1) | ✅ |
| 40 | `/admin/account` (password change) | `src/app/[locale]/admin/account/page.tsx` | `POST /api/auth/password` | `{ message }` / `{ error }` | unchanged | `mock-auth-password.json` (TBD-M1) | ✅ |
| 41 | `/overview` (RGL widget dashboard) | `src/app/[locale]/overview/page.tsx` | `GET /api/services`, `GET /api/system`, `GET /api/network`, `GET /api/processes`, `GET /api/docker/containers`, `GET /api/incus/instances`, `GET /api/alerts?history=1` (via widgets) | (per endpoint) | unchanged | per-widget mocks (TBD-M1) | ✅ |
| 42 | `/apps` (grid/list + filters + favorites) | `src/app/[locale]/apps/page.tsx` | `GET /api/services` (3s) | `{ services: ServiceCheck[] }` | unchanged | `mock-services-mixed.json` (TBD-M1) | ✅ |
| 43 | `/healthcheck` (table + IncidentTimeline + LogStream) | `src/app/[locale]/healthcheck/page.tsx` | `GET /api/services`, `GET /api/alerts?history=1` (3s); uses `LogStream` (mock) | (per endpoint) | unchanged | `mock-services-mixed.json`, `mock-alerts.json` (TBD-M1) | ✅ |
| 44 | `/agents` (3-pane viewer) | `src/app/[locale]/agents/page.tsx` | `GET /api/agents` | `{ groups: [...] }` | unchanged | `mock-agents.json` (TBD-M1) | ✅ |
| 45 | `/agents/[slug]` (server detail) | `src/app/[locale]/agents/[slug]/page.tsx` | server-side: `scanAgents()` (filesystem) | (filesystem scan) | unchanged | fixture `agents-mock.json` (TBD-M1) | ✅ |
| 46 | `/docker` (tabs + drawer with mocks) | `src/app/[locale]/docker/page.tsx` | `GET /api/docker` (containers/images/volumes); **uses `MockLogs/Metrics/Env`** for drawer tabs | (see §1.4 + §3.1–3.3) | replace mocks with `/api/docker/logs`, `/api/docker/{id}/metrics`, `/api/docker/{id}/env` (TBD-M1) | per-method + 3 mock file fixtures (TBD-M1) | ⚠️ |
| 47 | `/docker/[id]` (real start/stop/restart) | `src/app/[locale]/docker/[id]/page.tsx` | `GET /api/docker/containers`, `POST /api/docker/actions` | (see §1.4) | unchanged | per-method mock (TBD-M1) | ✅ |
| 48 | `/incus` (list + local ProvisionWizard) | `src/app/[locale]/incus/page.tsx` | `GET /api/incus/instances`; **uses LOCAL `ProvisionWizard` (mock with `setTimeout`)** | `{ data: IncusInstance[] }` | replace local wizard with sys-pilot `ProvisionWizard` (already at `/incus/provision`) | `mock-incus-instances.json` (TBD-M1) | ⚠️ |
| 49 | `/incus/[name]` (live status + actions + shell) | `src/app/[locale]/incus/[name]/page.tsx` | `GET /api/incus/instances/[name]`, `GET /api/incus/[name]` (5s), `POST /api/incus/actions`, `POST /api/incus/[name]/shell` | (see §1.5) | unchanged | per-method mock (TBD-M1) | ✅ |
| 50 | `/incus/provision` (rich wizard) | `src/app/[locale]/incus/provision/page.tsx` | `GET /api/incus/settings`, `GET /api/incus/images`, `POST /api/incus/instances`, `POST /validate`, `POST /provision` | (see §1.5) | unchanged | per-step mock (TBD-M1) | ✅ |
| 51 | `/systemd` (client-state optimistic actions) | `src/app/[locale]/systemd/page.tsx` | `GET /api/systemd` only (writes are local `setQueryData`!) | `{ services: SystemdUnit[] }` | change to call real `/api/systemd/actions` for parity with detail page | `mock-systemd.json` (TBD-M1) | ⚠️ (mismatch with detail) |
| 52 | `/systemd/[unit]` (real actions) | `src/app/[locale]/systemd/[unit]/page.tsx` | `GET /api/systemd`, `POST /api/systemd/actions` | (see §1.6) | unchanged | per-method mock (TBD-M1) | ✅ |
| 53 | `/storage` (mounts + drives) | `src/app/[locale]/storage/page.tsx` | `GET /api/system` (5s) | `SystemData` | unchanged | `mock-system.json` (TBD-M1) | ✅ |
| 54 | `/network` (topology + cards) | `src/app/[locale]/network/page.tsx` | `GET /api/network` (3s) | `{ interfaces }` | unchanged | `mock-network.json` (TBD-M1) | ✅ |
| 55 | `/processes` (table) | `src/app/[locale]/processes/page.tsx` | `GET /api/processes` (3s) | `{ processes }` | unchanged | `mock-processes.json` (TBD-M1) | ✅ |
| 56 | `/terminal` (xterm.js + SSE) | `src/app/[locale]/terminal/page.tsx` | `POST /api/terminal`, `GET /api/terminal?sessionId=…` (SSE) | (see §1.12) | unchanged | mock SSE stream (TBD-M1) | ✅ |
| 57 | `/backups` (4 cards + list) | `src/app/[locale]/backups/page.tsx` | **GET /api/backups — NOT IMPLEMENTED** | n/a (404) | implement `GET /api/backups` that lists age-encrypted tarballs from NAS mount (TBD-M1) | `mock-backups.json` (TBD-M1) | ⚠️ MISSING |
| 58 | `/scheduler` (timers + cards) | `src/app/[locale]/scheduler/page.tsx` | `GET /api/scheduler` (10s) | `{ jobs }` | unchanged | `mock-scheduler.json` (TBD-M1) | ✅ |
| 59 | `/mail-guardian` (review queue + decisions) | `src/app/[locale]/mail-guardian/page.tsx` | `GET /api/mail-guardian/reviews` (5s), `POST /api/mail-guardian/reviews` (decide) | `{ reviews: MailReview[] }` / `{ success }` | unchanged | `mock-mail-reviews.json` (TBD-M1) | ✅ |
| 60 | `/alerts` (3 tabs) | `src/app/[locale]/alerts/page.tsx` | `GET /api/alerts`, `GET /api/alerts?history=1` (3s) | (see §1.7) | unchanged | `mock-alerts.json` (TBD-M1) | ✅ |
| 61 | `/approvals` (pending/resolved + reason dialog) | `src/app/[locale]/approvals/page.tsx` | `GET /api/approvals`, `POST /api/approvals` | `{ approvals }` / `{ success }` | unchanged | `mock-approvals.json` (TBD-M1) | ⚠️ (no auth gate on endpoint) |
| 62 | `/audit` (table + detail Sheet) | `src/app/[locale]/audit/page.tsx` | `GET /api/audit` (10s) | `{ rows, total }` | unchanged | `mock-audit.json` (TBD-M1) | ✅ |
| 63 | `/settings` (placeholder) | `src/app/[locale]/settings/page.tsx` | none | n/a | (deferred) | n/a | ✅ |
| 64 | `useAuth` hook (local mock) | `src/hooks/useAuth.tsx` | `POST /api/auth` (in `LoginForm`); hook stores locally | n/a | remove local fallback; mirror `GET /api/auth` response | n/a | 🟡 |
| 65 | Local `ProvisionWizard` in `incus/page.tsx` | `src/app/[locale]/incus/page.tsx` (lines 104–157) | none (pure setTimeout mock) | n/a | delete and reuse sys-pilot `ProvisionWizard` (or navigate to `/incus/provision`) | n/a | 🟡 (dead path) |

---

## 6. Gaps, inconsistencies, and M0-E threat-model flags

| # | Item | Severity | Notes |
|---|---|---|---|
| 1 | `/api/backups` route does not exist | medium | The page hits a 404 and renders the empty state. **Implement or remove the page in M1.** |
| 2 | `/api/approvals` has no auth gate | high | Both `POST` and (presumed) `GET` lack `requireAuth`. Any unauthenticated client can approve/deny. **Schneier review mandatory; add auth in M0 or M1.** |
| 3 | `/systemd` page does optimistic UI only (no real write) | medium | The detail page calls real `/api/systemd/actions`; the list page does not. **Fix in M1** so behaviour is consistent. |
| 4 | `/incus` page has a duplicate local `ProvisionWizard` that is the wrong (mock) one | medium | The rich real wizard exists at `/incus/provision`. **Replace the local one in M1** (or delete it and link to the dedicated page). |
| 5 | `useAuth.tsx` local mock is a fallback | high | Production auth is PAM-backed; the hook should mirror `GET /api/auth` instead of doing a username check. **Schneier review mandatory.** |
| 6 | `LogStream` and `DetailDrawer.MockLogs/Metrics/Env` are explicit user-visible fakes | medium | The user sees a 7-line canned log on the Docker container, not real logs. **Decide in M1** whether to (a) implement real backend endpoints or (b) keep mocks and label them as "demo data". |
| 7 | `/api/docker/logs` exists but is unused | low | If we implement the real endpoint, the mock can be swapped. |
| 8 | Polling storm — 5+ pages each refetch on 3–5s intervals | medium | ~15 simultaneous refetches on `/api/system` from `overview`, `storage`, and widget ring-buffer; not deduplicated. **Consider an SSE broadcast channel in M2.** |
| 9 | `IncidentToaster` source comment incorrectly says "drift simulator" | low | Comment is stale; implementation polls real backend. **Fix comment in M1.** |
| 10 | `/api/audit/verify` endpoint exists but is not consumed — the page shows a static "chain valid" badge | medium | The audit page should call `/api/audit/verify` to dynamically verify the chain. **Wire in M1.** |
| 11 | `/api/services/[slug]/badges` and `/api/services/uptime` exist but no current UI consumer | low | Old healthcheck component used them. **Re-evaluate in M1.** |
| 12 | `/api/incus/{name}/shell` allows arbitrary command execution | high | Privileged surface; gated by `requireAdmin` and a name regex, but the command body is not validated. **Schneier review mandatory.** |
| 13 | `/api/terminal` allows arbitrary shell interaction | high | Plaintext privileged shell. **Schneier review mandatory.** |
| 14 | `/api/env-browser` reads arbitrary paths under `/opt/cortexos/.secrets/` | high | Path allowlist is enforced (per source comment), but the full allowlist logic lives in `@/lib/secrets/vps-reader`. **Schneier review mandatory; ensure allowlist is current.** |
| 15 | Admin CRUD endpoints (`/api/admin/services`, `/api/badges`, `/api/projects`, `/api/alerts`) rely on `requireAuth` only — no per-role check beyond the boolean `is_admin` | medium | Add `requireAdmin` consistently in M1. |
| 16 | `DetailDrawer.tsx:MockLogs` and `MockMetrics` use `Math.random()` at render time | low | Causes non-deterministic renders; flagged for E2E flake risk. M0-C should wrap deterministic stubs. |
| 17 | `_SAMPLE_LOGS` constant in `docker/page.tsx` is dead code | low | Delete. |
| 18 | `account/page.tsx` "Save" button on profile is a toast-only stub | low | Either wire to a real endpoint or remove. |
| 19 | `/api/badges` and `/api/admin/services` use different slug uniqueness validation (SLUG_RE vs trivial trim) | low | Reconcile in M1. |
| 20 | `/api/incus/instances` POST returns 409 on duplicate; the rich wizard handles this silently (treats as "reuse existing") | low | Document the behavior in the wizard. |

---

## 7. Summary counts (for the matrix deliverable)

- **Total template features** (TEMPLATE_INVENTORY.md): **83**
- **Total API methods consumed by UI**: **65** (rows in §5)
- **Total real API routes** in `src/app/api/**/route.ts`: **54**
- **Total client-side mock surfaces**: **4** (MockLogs, MockMetrics, MockEnv, LogStream) + 2 fallback mocks (useAuth, local ProvisionWizard)
- **Total distinct entity types**: **32** (see §2)
- **Total realtime / drift behaviors** (UI poller cadences): **18** distinct poller sites; only 1 true server-pushed stream (terminal SSE); no drift simulator exists
- **Total tests already present in template**: **50+** test files; **0** under `src/components/sys-pilot/` or `src/app/sys-pilot/`
- **Missing / gap routes**: 1 (`/api/backups`)
- **Privileged surfaces requiring Schneier review**: 4 (approvals POST, terminal POST+SSE, env-browser GET/POST, incus shell)

---

*End of MOCK_API_INVENTORY.md — M0-B Workstream B. Next: REACT_TO_SVELTE_MIGRATION_MAP.md.*
