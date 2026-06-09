# CortexOS — Backend API Specification

This document is the contract the frontend expects from the real backend.
Everything currently lives in `src/mocks/` (api.ts, types.ts, seed.ts, drift.ts);
this file maps every mock surface to the HTTP / WebSocket endpoint that must
replace it, the JSON shape, and the runtime semantics (polling cadence, auth,
errors, side effects).

> **Goal**: A backend developer should be able to implement every route below
> and have the frontend keep working without a single change to the React code.
> The thin wrapper is `src/mocks/api.ts` — swap each function body for `fetch`
> and the rest of the app follows.

---

## 1. Conventions

### 1.1 Base URL
- Same-origin: all routes live under `/api/v1/*`.
- Server functions (`createServerFn`) are wire-compatible — you may keep RPC
  or expose REST, but the JSON shapes below are normative.

### 1.2 Auth
- Cookie-session (HttpOnly, SameSite=Lax) issued at `POST /api/v1/auth/login`.
- Every authenticated request carries the cookie automatically.
- The frontend reads the current principal from `GET /api/v1/auth/me` →
  `PamUser` (see types).
- Admin-only endpoints are flagged **🔒 admin**. They must check
  `principal.is_admin === true` and return `403` otherwise.

### 1.3 Content type
- Request and response bodies are JSON unless stated otherwise.
- Timestamps are ISO-8601 strings in UTC (`2026-06-02T11:42:13.000Z`).
- Byte sizes are integer bytes; rates are kbps (kilobits/second) unless suffixed.

### 1.4 Errors
All errors use this envelope:
```json
{ "error": { "code": "string", "message": "human readable", "details": {} } }
```
Standard codes: `unauthorized` (401), `forbidden` (403), `not_found` (404),
`conflict` (409), `validation` (422), `rate_limited` (429), `internal` (500).

### 1.5 Real-time strategy
Most read endpoints are polled by TanStack Query at 3s intervals (`refetchInterval`).
The backend MAY upgrade to Server-Sent Events at `/api/v1/stream` returning
named events that mirror the polled keys (`system`, `network`, `processes`,
`services`, `alerts`); the frontend can subscribe and stop polling for those
keys. Terminal traffic is **always WebSocket** (§ 4).

### 1.6 Pagination
Lists that can grow unbounded (`audit`, `alerts/history`, `notifications`)
accept `?cursor=<opaque>&limit=<1..200>` and respond with:
```json
{ "items": [...], "nextCursor": "opaque-or-null" }
```
The frontend wrappers in `src/mocks/api.ts` will be adjusted to read `items`;
fixed-size lists (sensors, drives, network interfaces) return a plain array.

---

## 2. REST endpoints

All response shapes match the TypeScript types in `src/mocks/types.ts`.
Quote them verbatim — the frontend is strict.

### 2.1 System telemetry

| Method | Path                  | Response       | Cadence | Notes |
| ------ | --------------------- | -------------- | ------- | ----- |
| GET    | `/api/v1/system`      | `SystemData`   | 3s poll | cpu %, mem, drives, mounts, load, uptime, sensors |
| GET    | `/api/v1/processes`   | `ProcessInfo[]`| 3s poll | top processes, top-N (default 50) |
| GET    | `/api/v1/network`     | `NetworkData`  | 3s poll | per-interface rx/tx + lifetime totals |
| GET    | `/api/v1/history`     | `{t:number,cpu:number,mem:number}[]` | 3s poll | rolling 60-point window, oldest first |

**Sensors contract** (`SystemData.sensors`):
- `cpuTemperature`: single representative sensor or `null` when missing.
- `temperatures`/`fans`/`voltages`: arrays of `MachineSensor` (units: `celsius`,
  `rpm`, `volts`). Empty arrays are valid.

### 2.2 Services & healthcheck

| Method | Path                                  | Response         | Notes |
| ------ | ------------------------------------- | ---------------- | ----- |
| GET    | `/api/v1/services`                    | `Service[]`      | union of apps, systemd, docker, processes |
| POST   | `/api/v1/services/:slug/recheck`      | `Service`        | force a synchronous probe |
| POST   | `/api/v1/services/:slug/toggle-active`| `Service`        | 🔒 admin, flips `is_active` |
| GET    | `/api/v1/services/:slug`              | `Service`        | detail view |

### 2.3 Docker

| Method | Path                                     | Response             | Notes |
| ------ | ---------------------------------------- | -------------------- | ----- |
| GET    | `/api/v1/docker/containers`              | `DockerContainer[]`  | |
| GET    | `/api/v1/docker/images`                  | `DockerImage[]`      | |
| GET    | `/api/v1/docker/volumes`                 | `DockerVolume[]`     | |
| POST   | `/api/v1/docker/containers/:id/start`    | `DockerContainer`    | 🔒 admin |
| POST   | `/api/v1/docker/containers/:id/stop`     | `DockerContainer`    | 🔒 admin |
| POST   | `/api/v1/docker/containers/:id/restart`  | `DockerContainer`    | 🔒 admin |
| DELETE | `/api/v1/docker/containers/:id`          | `204`                | 🔒 admin |
| GET    | `/api/v1/docker/containers/:id/logs`     | `text/plain` stream  | `?tail=200&follow=true` (SSE or chunked) |

### 2.4 Incus

| Method | Path                                | Response              | Notes |
| ------ | ----------------------------------- | --------------------- | ----- |
| GET    | `/api/v1/incus`                     | `IncusInstance[]`     | |
| POST   | `/api/v1/incus`                     | `IncusInstance`       | 🔒 admin, body matches `IncusInstance` without `status` & `last_validation` |
| POST   | `/api/v1/incus/:slug/validate`      | `IncusInstance`       | 🔒 admin |
| POST   | `/api/v1/incus/:slug/provision`     | `IncusInstance`       | 🔒 admin |
| POST   | `/api/v1/incus/:slug/start`         | `IncusInstance`       | 🔒 admin |
| POST   | `/api/v1/incus/:slug/stop`          | `IncusInstance`       | 🔒 admin |
| DELETE | `/api/v1/incus/:slug`               | `204`                 | 🔒 admin |

`status` transitions: `draft → validated → provisioning → active`; `failed`
is reachable from any state.

### 2.5 Systemd

| Method | Path                              | Response        | Notes |
| ------ | --------------------------------- | --------------- | ----- |
| GET    | `/api/v1/systemd`                 | `SystemdUnit[]` | |
| POST   | `/api/v1/systemd/:name/start`     | `SystemdUnit`   | 🔒 admin |
| POST   | `/api/v1/systemd/:name/stop`      | `SystemdUnit`   | 🔒 admin |
| POST   | `/api/v1/systemd/:name/restart`   | `SystemdUnit`   | 🔒 admin |
| POST   | `/api/v1/systemd/:name/enable`    | `SystemdUnit`   | 🔒 admin |
| POST   | `/api/v1/systemd/:name/disable`   | `SystemdUnit`   | 🔒 admin |

### 2.6 Alerts

| Method | Path                              | Response                            | Notes |
| ------ | --------------------------------- | ----------------------------------- | ----- |
| GET    | `/api/v1/alerts/rules`            | `AlertRule[]`                       | |
| POST   | `/api/v1/alerts/rules`            | `AlertRule`                         | 🔒 admin |
| PATCH  | `/api/v1/alerts/rules/:id`        | `AlertRule`                         | 🔒 admin |
| DELETE | `/api/v1/alerts/rules/:id`        | `204`                               | 🔒 admin |
| GET    | `/api/v1/alerts/history`          | paginated `AlertHistory`            | newest first |
| POST   | `/api/v1/alerts/history/:id/ack`  | `AlertHistory`                      | 🔒 admin |

### 2.7 Approvals & audit

| Method | Path                                 | Response                     | Notes |
| ------ | ------------------------------------ | ---------------------------- | ----- |
| GET    | `/api/v1/approvals`                  | `ApprovalRequest[]`          | pending first |
| POST   | `/api/v1/approvals/:id/approve`      | `ApprovalRequest`            | 🔒 admin |
| POST   | `/api/v1/approvals/:id/deny`         | `ApprovalRequest`            | 🔒 admin, body `{ reason: string }` |
| GET    | `/api/v1/audit`                      | paginated `AuditEntry`       | filters: `?actor=&tool=&decision=` |

### 2.8 Identity

| Method | Path                                 | Response                | Notes |
| ------ | ------------------------------------ | ----------------------- | ----- |
| GET    | `/api/v1/auth/me`                    | `PamUser`               | |
| POST   | `/api/v1/auth/login`                 | `PamUser` + Set-Cookie  | body `{ username, password }` |
| POST   | `/api/v1/auth/logout`                | `204`                   | |
| GET    | `/api/v1/users`                      | `PamUser[]`             | 🔒 admin |

### 2.9 Projects & agents

| Method | Path                          | Response       | Notes |
| ------ | ----------------------------- | -------------- | ----- |
| GET    | `/api/v1/projects`            | `Project[]`    | |
| POST   | `/api/v1/projects`            | `Project`      | 🔒 admin |
| GET    | `/api/v1/projects/:slug`      | `Project`      | |
| DELETE | `/api/v1/projects/:slug`      | `204`          | 🔒 admin |
| GET    | `/api/v1/agents`              | `Agent[]`      | |
| GET    | `/api/v1/agents/:slug`        | `Agent`        | includes file tree |
| PUT    | `/api/v1/agents/:slug/files`  | `Agent`        | 🔒 admin, body `{path, content}[]` |

### 2.10 Mail Guardian

| Method | Path                                  | Response       | Notes |
| ------ | ------------------------------------- | -------------- | ----- |
| GET    | `/api/v1/mail`                        | `MailReview[]` | newest first |
| POST   | `/api/v1/mail/:id/approve`            | `MailReview`   | sets `status=approved` |
| POST   | `/api/v1/mail/:id/flag`               | `MailReview`   | sets `status=flagged` |
| POST   | `/api/v1/mail/batch`                  | `MailReview[]` | body `{ ids: string[], action: "approve" \| "flag" }` — used by the multi-select toolbar |

### 2.11 Notifications, env, badges

| Method | Path                              | Response             | Notes |
| ------ | --------------------------------- | -------------------- | ----- |
| GET    | `/api/v1/notifications`           | paginated            | |
| POST   | `/api/v1/notifications/:id/read`  | `204`                | |
| GET    | `/api/v1/env-files`               | `{ path, vars }[]`   | values redacted unless 🔒 admin |
| GET    | `/api/v1/badges`                  | `Badge[]`            | |

### 2.12 Backups & scheduler

| Method | Path                                 | Response             | Notes |
| ------ | ------------------------------------ | -------------------- | ----- |
| GET    | `/api/v1/backups`                    | `BackupSnapshot[]`   | |
| POST   | `/api/v1/backups`                    | `BackupSnapshot`     | 🔒 admin, body `{ target, kind }` — starts a snapshot |
| POST   | `/api/v1/backups/:id/restore`        | `{ jobId: string }`  | 🔒 admin, async |
| DELETE | `/api/v1/backups/:id`                | `204`                | 🔒 admin |
| GET    | `/api/v1/scheduler`                  | `SchedulerJob[]`     | |
| POST   | `/api/v1/scheduler/:id/toggle`       | `SchedulerJob`       | 🔒 admin, flips `enabled` |
| POST   | `/api/v1/scheduler/:id/run`          | `SchedulerJob`       | 🔒 admin, triggers ad-hoc execution |

---

## 3. Mock-to-endpoint cheat sheet

Each entry in `src/mocks/api.ts` maps 1:1 to a route above. The simplest
migration is to keep the function shape and replace the body with `fetch`:

```ts
// Before
network: async () => { await wait(); return live.network() ?? initialNetwork; },

// After
network: async () => {
  const res = await fetch("/api/v1/network", { credentials: "include" });
  if (!res.ok) throw await asApiError(res);
  return res.json() as Promise<NetworkData>;
},
```

`src/mocks/drift.ts` is purely a client-side stand-in for live updates and is
deleted once the backend ships SSE or once polling latency is acceptable.

---

## 4. Terminal — WebSocket + PTY protocol

The Terminal page (`src/features/Terminal.tsx`) opens one xterm.js instance
per tab and broadcasts user input to either the active tab or every open tab
("send-keys to all panes", tmux-style). The backend must expose one PTY per
tab, multiplexed over WebSocket.

### 4.1 Lifecycle

```
Browser                                         Backend (PTY supervisor)
   │   GET /api/v1/terminal/sessions             │
   │   ──────────────────────────────────────►   │  list current owner sessions
   │   ◄──────────── 200 SessionMeta[]            │
   │                                              │
   │   POST /api/v1/terminal/sessions             │
   │   { cols, rows, shell?, cwd? }               │
   │   ──────────────────────────────────────►   │  fork PTY (default /bin/bash -l)
   │   ◄──────────── 201 SessionMeta              │
   │                                              │
   │   WS  /api/v1/terminal/sessions/:id/ws       │
   │   ─────────────────────────────────────────► │  attach, stream stdin/stdout
   │   ◄═══════════════════ binary/text frames ══ │
   │                                              │
   │   DELETE /api/v1/terminal/sessions/:id       │
   │   ──────────────────────────────────────►   │  SIGHUP + reap
```

`SessionMeta`:
```ts
interface SessionMeta {
  id: string;            // ULID
  name: string;          // "shell-1"
  cols: number;
  rows: number;
  shell: string;         // resolved path, e.g. "/bin/bash"
  cwd: string;
  createdAt: string;     // ISO timestamp
  pid: number;
  status: "running" | "exited";
  exitCode?: number;
}
```

**🔒 admin** — the full namespace is admin-only; non-admin requests return 403
(matches the current `useAuth().user.is_admin` gate in the page).

### 4.2 WebSocket frame protocol

Use one of:
- **Binary**: raw bytes from the PTY → write directly to xterm
  (`term.write(new Uint8Array(frame))`).
- **Text JSON**: `{ "type": "stdout", "data": "..." }` if you cannot send binary.

The frontend will pick binary when `Sec-WebSocket-Protocol: cortex.term.v1`
is negotiated.

#### Client → server
| Type     | Payload                                | Purpose |
| -------- | -------------------------------------- | ------- |
| `stdin`  | `string` (UTF-8) — bytes typed by user | Forward to PTY master |
| `resize` | `{ cols: number, rows: number }`       | `ioctl(TIOCSWINSZ)` |
| `signal` | `{ signal: "SIGINT" \| "SIGTERM" }`    | Kill foreground group |
| `ping`   | `{}`                                   | Keepalive (server replies `pong`) |

#### Server → client
| Type     | Payload                       | Purpose |
| -------- | ----------------------------- | ------- |
| `stdout` | `string` or binary frame       | Append to xterm |
| `exit`   | `{ code: number }`             | PTY exited — frontend closes the tab |
| `error`  | `{ message: string }`          | Show toast and close WS |
| `pong`   | `{}`                           | Keepalive ack |

Binary mode: every inbound frame is stdout, every outbound binary frame is
stdin. Use text JSON only for control messages (`resize`, `signal`, `exit`,
`error`) — multiplex by sending a leading control byte (`0x01` = control JSON,
`0x02` = data) if you want a single binary channel.

### 4.3 Tabs

Each browser tab maps to one PTY session. The frontend creates a new session
via `POST /sessions` when the user clicks the **+** button and tears it down
via `DELETE /sessions/:id` when they close it. Session IDs are persisted
client-side in memory only; on full reload the frontend re-reads
`GET /sessions` and re-attaches to any sessions still alive (optional —
reasonable default is to start fresh).

### 4.4 Broadcast / tmux send-keys

The footer bar has a **Broadcast** toggle. When OFF, the typed command is
sent to the active tab's WebSocket as `stdin` (followed by `\r`). When ON,
the same payload is fan-out written to every open session's WebSocket.

Two backend implementation strategies:

1. **Client-side fan-out (default)** — the frontend simply loops over its
   session handles and writes the same `stdin` frame to each. The backend
   needs no extra endpoint. This is what the current code does.
2. **Server-side fan-out (optional optimisation)** — expose
   `POST /api/v1/terminal/broadcast` with body
   ```json
   { "ids": ["sess-1","sess-2"], "input": "kubectl get pods\r" }
   ```
   The backend writes `input` to each PTY master. Useful when the same
   browser tab needs to drive sessions it does not currently have WS
   connections for. The frontend will adopt this if the endpoint exists.

### 4.5 tmux send-keys passthrough

If you run the user's shell inside a real `tmux` server, the same broadcast
input can target panes by name:
```bash
tmux send-keys -t cortex:0.0 'kubectl get pods' C-m
```
Expose:
```
POST /api/v1/terminal/tmux/send-keys
body: { "target": "cortex:0.0", "keys": "kubectl get pods", "enter": true }
```
This is **optional**; the WebSocket `stdin` channel above is sufficient for
the current UI. Add it only if you want tmux-aware tooling (named windows,
detached sessions, replaying scrollback).

### 4.6 Sizing & rendering rules the frontend obeys

- The frontend calls `fit.fit()` on mount, on window resize, and when a tab
  becomes active. Expect a `resize` frame after each of those.
- Initial `cols`/`rows` come from the first `resize` after WS open; the
  backend should not assume the values from `POST /sessions` are final.
- Output is written verbatim to xterm — keep ANSI escape sequences intact,
  do not strip colour codes, do not insert CRLF normalisation (xterm is
  configured with `convertEol: true`).
- Encoding is UTF-8. Multi-byte characters MUST NOT be split across frames
  unless you also send a continuation marker; otherwise xterm will render
  replacement glyphs.

### 4.7 Security checklist

- Require `principal.is_admin === true` on every terminal endpoint.
- Per-user session limit (suggested: 8 concurrent PTYs).
- Idle timeout: kill PTY after 30 min with no stdin and no WS activity.
- Drop the WS if the cookie expires mid-session.
- Audit every `POST /sessions` and every `signal` frame into the audit log
  (`AuditEntry` with `tool: "terminal"`).
- Rate-limit `stdin` to ~1 MB/s per session to stop runaway loops.

---

## 5. Mutations the frontend already wires

The pages below already call mutation-style helpers via
`queryClient.setQueryData` for optimistic UI. When backed by real endpoints,
wrap them in `useMutation` with `onSuccess: invalidate` against the listed
query key.

| Page             | Action                | Endpoint                                    | Query key to invalidate |
| ---------------- | --------------------- | ------------------------------------------- | ----------------------- |
| Mail Guardian    | Approve / Flag (row)  | `POST /mail/:id/approve` \| `/flag`         | `["mail"]`              |
| Mail Guardian    | Batch approve / flag  | `POST /mail/batch`                          | `["mail"]`              |
| Backups          | New snapshot          | `POST /backups`                             | `["backups"]`           |
| Backups          | Restore               | `POST /backups/:id/restore`                 | `["backups"]`           |
| Scheduler        | Toggle enabled        | `POST /scheduler/:id/toggle`                | `["scheduler"]`         |
| Scheduler        | Run now               | `POST /scheduler/:id/run`                   | `["scheduler"]`         |
| Approvals        | Approve / Deny        | `POST /approvals/:id/(approve\|deny)`       | `["approvals"]`         |
| Services         | Recheck / Toggle      | `POST /services/:slug/(recheck\|toggle…)`   | `["services"]`          |

---

## 6. Open questions for the backend team

1. SSE vs WebSocket for the polled telemetry — frontend is agnostic but
   prefers SSE to keep WS reserved for terminal traffic.
2. Multi-tenant scoping — if multiple admins share the host, do we expose
   each other's terminal sessions in `GET /terminal/sessions` or scope to
   the caller? Default assumption: scope to caller.
3. Backup engine — the `kind` enum currently lists `zfs | docker-volume |
   postgres`; confirm before wiring real provisioners.
4. tmux integration — adopt server-side broadcast (§ 4.4 strategy 2) only if
   we expect non-browser drivers (CLI, automation).
