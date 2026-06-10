# API Contract (frozen interface)

> This is the **coordination keystone**. Backend WPs implement these endpoints; frontend WPs
> consume them. Neither side may change a shape without editing this file and notifying
> dependents. Types come from `@cortexos/contracts` (reused verbatim — framework-agnostic zod).
> The legacy SvelteKit endpoints under `packages/dashboard/src/routes/api/**` are the
> authoritative reference for exact field names and behavior.

## Transport

- All endpoints live under `/api/*` in `packages/dashboard-next`, served by TanStack server
  routes (Wave 0 establishes the `defineApiRoute` wrapper).
- JSON in, JSON out. Same-origin. Session via `cortexos_session` cookie; CSRF via
  `cortexos_csrf` cookie echoed in the `x-csrf-token` header on all non-GET requests.

## Response envelope

**Success:** the handler's value is returned as JSON with HTTP 200 (or 201 for creates):
```jsonc
{ /* endpoint-specific payload, see table */ }
```

**Error:** a typed envelope (mirror of legacy `src/lib/server/errors/types.ts`):
```jsonc
{ "code": "validation|auth|permission|not_found|rate_limit|approval_required|system",
  "message": "human-readable",
  "details": [ { "field": "x", "message": "..." } ],   // validation only
  "retryAfter": 60,                                      // rate_limit only
  "action": "docker.rm", "ttlSec": 60 }                 // approval_required only
```
HTTP status by code: validation→400, auth→401, permission→403, not_found→404,
rate_limit→429, approval_required→412, system→500.

## Auth levels (per endpoint)

- `any` — authenticated user (valid session).
- `admin` — session user is in `cortexos-admin`.
- `<group>` — specific RBAC group.
- `public` — no auth (login + health only).

Destructive actions additionally require an **approval token** (`x-cortex-approval-token`
header) minted via the approvals flow; the server `consume()`s it (single-use, session-bound,
action-hash-bound). See `02-CONVENTIONS.md` §Approvals.

## Rate limits (defaults; override per endpoint)

unauth strict 30/min · authed 10/min · admin 30/min · health-recheck 10/min · env-unlock 5/min.

## Endpoint catalog

> Columns: METHOD PATH · auth · input · output · backing module (legacy path to port).
> "repo" = `src/server/db/repos/*`; "bridge" = host execFile module.

### Auth  (WP-20)
- `POST /api/auth/login` · public · `{username,password}` · `{user, session}` + sets cookies · `server/auth`
- `POST /api/auth/logout` · any · — · `{ok:true}` · `server/auth`
- `GET  /api/auth/me` · any · — · `{user, session}` · `server/auth`

### Services & health  (WP-10)
- `GET  /api/services` · any · query(category,kind,status,activeOnly,page,pageSize) · `{rows:Service[],total}` · repo services
- `POST /api/services` · admin · ServiceCreate · `Service` · repo services
- `GET  /api/services/:id` · any · — · `Service` · repo services
- `PATCH/DELETE /api/services/:id` · admin · ServicePatch · `Service`|`{ok}` · repo services
- `GET  /api/services/:id/health` · any · query(limit) · `{snapshots:HealthSnapshot[]}` · repo + serviceHealthLog
- `POST /api/services/:id/health` · admin · `{source}` · `{snapshot}` · health probe (reuse `server/health`)

### Docker  (WP-11)
- `GET /api/docker/containers|images|volumes` · any · — · `{items:[...]}` · bridge `server/docker/real-data` (images: dedup + drop `<none>`)
- `POST /api/docker/actions` · admin (destructive→approval) · `{action,container}` allowlisted · `{result}` · bridge dispatch

### Incus  (WP-12)
- `GET  /api/incus/instances` · any · — · `{items:IncusInstance[]}` · bridge `server/incus/bridge`
- `POST /api/incus/actions` · admin (destructive→approval) · `{action,name,...}` · `{result}` · bridge
- `POST /api/incus/:name/exec-named` · admin · `{op,args}` allowlisted · `{argv,status,output}` · bridge
- `GET  /api/incus/:name/logs` · any · query(tail) · `{lines:[]}` · bridge

### Systemd  (WP-13)
- `POST /api/systemd/actions` · admin (destructive→approval) · `{action,unit}` allowlisted · `{result}` · bridge
- `GET  /api/systemd/:name/logs` · any · query(lines) · `{lines:[]}` · journalctl bridge

### System / network / processes / storage  (WP-14)
- `GET /api/system` · any · — · `{uptime,load,memory,disk}` · `os` + `df`
- `GET /api/processes` · any · — · `{processes:[]}` · `ps`
- `GET /api/network` · any · — · `{interfaces:[]}` — **physical NICs only** (`/sys/class/net/*/device`) · `ip`/`/proc/net/dev`
- `GET /api/storage` (or via /system) · any · — · `{disks:[],mounts:[]}` — **physical only** (exclude tmpfs/overlay/loop/...) · `lsblk`/`df`

### Mail-Guardian  (WP-15)
- `GET/POST /api/mail-guardian/accounts` · admin · MailAccount(Create) · `{accounts}`|`MailAccount` · repo mail_guardian
- `PUT/PATCH/DELETE /api/mail-guardian/accounts/:slug` · admin · MailAccountPatch · `MailAccount`|`{ok}` · repo
- `GET  /api/mail-guardian/reviews` · any · query(account,status,page) · `{reviews}` · repo
- `POST /api/mail-guardian/:id/flag|approve` · admin · — · `{review}` · repo
- `POST /api/mail-guardian/batch` · admin · `{ids,decision}` · `{updated}` · repo

### Approvals  (WP-16)
- `GET  /api/approvals` · any · query(status,page) · `{pending:[]}` · repo pending_approvals
- `POST /api/approvals` · admin · `{action,payload,ttlSec}` · `{token,expiresAt,...}` · `server/approval` mint
- `POST /api/approvals/:id/grant` · admin · — · `{ok, token}` · approval consume
- `POST /api/approvals/:id/revoke` · admin · — · `{ok}` · repo
- `DELETE /api/approvals/:id` · admin · — · `{ok}` · repo

### Audit  (WP-16)
- `GET /api/audit` · any · query(actor,surface,action,result,since,page) · `{events:[],surfaces,actions}` · repo audit
- `GET /api/audit/verify` · admin · query(from) · `{ok,brokenAt?}` · `server/audit` HMAC chain verify

### Alerts  (WP-17)
- `GET/POST /api/alerts` · any/admin · AlertCreate · `{alerts}`|`Alert` · repo alerts
- `GET/PATCH/DELETE /api/alerts/:id` · any/admin · AlertPatch · `Alert`|`{ok}` · repo
- `GET /api/alerts/history` · any · query(ruleId,page) · `{history}` · repo

### Env browser  (WP-18)
- `GET  /api/env-browser` · admin · query(path allowlisted) · `{path,revealed,revealExpiresAt,entries:[{key,value,masked}]}` — **masked unless a live reveal grant** · `server/env-reveal`
- `POST /api/env-browser/unlock` · admin · `{password}` · `{ok,expiresAt,ttlSec}` — **PAM re-auth → 10-min grant** · `server/auth` PAM + `env-reveal`

### Terminal  (WP-19)
- `GET /api/terminal` (WebSocket upgrade) · admin · — · PTY stream (allowlisted shell) · node-pty/bridge. Replaces sys-pilot's mock PTY.

### Agents  (WP-21)
- `GET  /api/agents` · any · — · `{agents:[]}` · hermes profiles registry read
- `POST /api/agents/:slug/files` · admin · multipart · `{ok}` · fs (scoped to profile dir)

### Command audit (used by action dispatchers)  (WP-16)
- `GET/POST/PATCH /api/dashboard_command_audit` · admin · two-phase lifecycle · `{...}` · repo dashboard_command_audit

## Frozen entity types (`@cortexos/contracts`)

`Service`, `ServiceHealthSnapshot`, `ServiceStatus`, `ServiceKind`, `HealthType`, `BadgeRef`,
`User`, `Session`, `GroupName`, `IncusInstance`, `Alert`, `AuditEvent`, `ApprovalToken`,
`MailGuardianReview`/`MailGuardianAccount` (+ the mail_guardian Drizzle types).
Frontend adapts these to sys-pilot's component props in an adapter layer (`02-CONVENTIONS.md`).
