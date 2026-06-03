# M0-A: Current CortexOS Architecture Audit

> **Author:** Linus Torvalds (TS Backend Engineer)
> **Workstream:** A — existing-system audit for the dashboard revamp.
> **Worktree:** `/Users/heitor/Developer/github.com/bloodf/cortexos/.worktrees/m0-a-cortexos-audit`
> **Branch:** `feature/m0-a-cortexos-audit` (from `origin/main` @ `68ba13b`)
> **Date:** 2026-06-02
> **Scope:** Read-only. No existing code was modified.

---

## 0. Reading Note (IMPORTANT — read before using this document)

The task brief in the parent session assumes the dashboard lives at
`packages/cortex-dashboard/`. **That assumption is wrong on `main`.** The
production dashboard is committed at **`packages/dashboard/`** — see commit
`5766abb` ("chore(dashboard): finalize UI port and rename to packages/dashboard")
and the `feat(dashboard): restore real data wiring lost in the sys-pilot merge`
chain (`6f31f95`, `7ea3ef9`, `68ba13b`).

The legacy `packages/cortex-dashboard/` directory still exists in the main work
tree **only as an UNTRACKED, un-committed local copy** of the older code (its
`AGENTS.md` / `CLAUDE.md` are the source of the brief's outdated deployment
expectations). It is **not** in the worktree, **not** built by CI, and **not**
what serves at `https://cortex.example.com/`.

This audit maps the **actually-tracked, actually-deployed** dashboard at
`packages/dashboard/`. Where the tracked code disagrees with the brief or with
stale docs, I flag it explicitly and propose a resolution. Section 11 ("Scope
changers") is the punch list.

Throughout the document every line citation uses the form
`path/file.ts:LINE` against the worktree path above.

---

## 1. Repo tree & workspace layout

### 1.1 Workspace configuration

- **pnpm workspace** — `pnpm-workspace.yaml:1-2` — single root pattern:
  ```yaml
  packages:
    - 'packages/*'
  ```
- **Root `package.json`** — `package.json:1-10` — `name: cortexos-monorepo`,
  `private: true`, `packageManager: pnpm@10.12.1`, `engines.node: ">=22"`.
  No root scripts; all work is done in package dirs.
- **No `stacks/`, `templates/`, or `docs/SECRETS.md`** exist in the worktree or
  on the tracked main branch. See §11 Finding F-3.

### 1.2 Packages in the workspace (all under `packages/`)

| Path | Package name | Type | Notes |
|------|-------------|------|-------|
| `packages/dashboard/` | `@cortexos/dashboard` (see `package.json:2`) | Next.js 16 app | **The production dashboard.** |
| `packages/cortex-audit/` | `@cortexos/audit` (see `packages/cortex-audit/package.json:2`) | Library | Hash-chained TimescaleDB audit log. |
| `packages/cortex-mail-guardian/` | (own `package.json`) | TS service | Mail triage worker. |
| `packages/cortex-telemetry/` | (own `package.json`) | Library | OpenLLMetry/Langfuse wrapper. |
| `packages/paperclip-adapter/` | (own `package.json`) | Library | Connects to the `paperclip-bridge`. |

Workspace `pnpm-workspace.yaml:1-2` will pick up **any** new package under
`packages/*` automatically — no registration needed.

### 1.3 Top-level non-`packages/` directories

| Dir | Tracked? | Contents |
|-----|---------|----------|
| `prompts/` | Yes | `00-bootstrap.md`, `tools/*` install spokes. |
| `scripts/` | Yes | `cortex-hermes-9router.py`, `cortex-qwen-hermes-9router.sh`, `incus-create-project.sh`, `ops/cortex-auto-update.sh`, `ops/cortex-backup.sh`. |
| `docs/` | Yes | `docs/` exists in worktree (manifests, plans, etc.) — but no `SECRETS.md`. |
| `stacks/` | **Yes (in main)**, **missing from this worktree** | `cortex-dashboard-root-helper`, `cortex-incus`, `cortex-sandbox-runner`. See §11 Finding F-3. |
| `templates/` | **Yes (in main)**, **missing from this worktree** | Systemd unit templates, `.secrets` templates. See §11 Finding F-3. |
| `docker-compose.yml` | Yes (`docker-compose.yml:1-25`) | Local-dev Postgres only (profile `local-db`). Production dashboard is **NOT** run via this file. |
| `.github/workflows/` | Yes | `ci.yml`, `distro-matrix.yml`, `schema-check.yml`, `secrets-scan.yml`, `release*.yml`, plus deprecated ones (see §6). |
| `renovate.json` | Yes | `extends: ["config:recommended"]` (`renovate.json:1-5`). |
| `dependabot.yml` | Yes | GitHub-native dep updates. |
| `Dockerfile` | Yes | The repo-root Dockerfile, if any — the dashboard itself is built from `packages/dashboard/Dockerfile`. |

> The `stacks/` and `templates/` directories exist on the tracked `main` branch
> but are missing from the freshly-created worktree at
> `.worktrees/m0-a-cortexos-audit`. They are real and tracked, but the
> `git worktree` copy is missing the directories because `.worktrees/` is
> listed in `.gitignore` patterns. **Action:** re-run the audit from a
> non-worktree checkout or add `--no-ignore` if you need the full tree.
> See §11 Finding F-3.

---

## 2. `packages/dashboard/` inventory

`packages/dashboard/` is the **current** production dashboard. Layout:

```
packages/dashboard/
├── package.json                        (86 lines, @cortexos/dashboard v0.1.0)
├── next.config.ts                      (26 lines)
├── server.ts                           (39 lines — custom http+socket.io server)
├── tsconfig.json / eslint.config.mjs / vitest.config.ts / vitest.setup.ts
├── playwright.config.ts
├── Dockerfile / docker-compose.yml / docker-entrypoint.sh
├── dashboard.env.example
├── .dockerignore / .gitignore
├── components.json                     (shadcn "base-nova" style)
├── README.md                           (23 lines)
├── docs/LOVABLE-PROMPT.md              (the Sys-pilot design spec)
├── e2e/audit-viewer.spec.ts            (1 Playwright test)
├── messages/{en,es,pt-br}.json         (next-intl locale files)
├── migrations/
│   ├── 001_schema.sql                  (300 lines)
│   ├── 002_seed.sql                    (262 lines)
│   ├── 003_incus_instances.sql
│   ├── 004_reconcile_health.sql
│   └── rollback/004_reconcile_health.rollback.sql
├── public/                             (icons + static assets)
├── scripts/
│   ├── migrate.js                      (100 lines — standalone CJS migration runner)
│   ├── migrate.ts                      (TS twin for dev)
│   ├── dynamic-seed.js                 (146 lines — spoke-aware catalog activation)
│   ├── provision-vps.sh                (220 lines — fresh-VPS provisioner)
│   └── change-admin-password.sh        (one-shot legacy script)
├── e2e/                                (Playwright; 1 spec)
└── src/
    ├── app/                            (Next.js App Router)
    ├── lib/                            (server-side + shared libs)
    ├── components/                     (UI components)
    ├── hooks/                          (client hooks)
    ├── i18n/                           (next-intl config)
    ├── proxy.ts / proxy.test.ts        (E2E proxy helper, ~3KB)
    └── ...
```

File counts (excluding `node_modules`, `.next`):
- TypeScript `.ts` files: 173
- React `.tsx` files: 253
- SQL files: 6

### 2.1 Routes (Next.js App Router, `packages/dashboard/src/app/`)

Layout structure:
- Root `app/page.tsx:1-13` — locale-aware redirect to `/{locale}/overview`.
- Root `app/layout.tsx:1-87` — providers: `NextIntlClientProvider`,
  `QueryProvider` (TanStack Query), `ThemeProvider` (preset + dark/light),
  `AuthProvider`, `Toaster`, `AlertToastListener`. Inline no-flash script
  reconciles preset cookie before paint (`app/layout.tsx:51-70`).
- Locale segment `app/[locale]/` — every user-facing page is below this
  segment.
- App-shell chrome under `app/sys-pilot/` (`AppShell.tsx`, `Sidebar.tsx`,
  `TopBar.tsx`, `CommandPalette.tsx`, `MobileTabBar.tsx`, `NavConfig.ts`).
- API routes under `app/api/`.

User-facing pages (under `app/[locale]/`):

| Page | File | Role |
|------|------|------|
| `login` | `app/[locale]/login/page.tsx:1-27` | Login form (PAM-backed). |
| `overview` | `app/[locale]/overview/page.tsx:1-173` | Draggable widget grid. |
| `system` | `app/[locale]/system/page.tsx:1-13` | Redirects to `/storage`. |
| `dashboard` | `app/[locale]/dashboard/page.tsx` | (legacy alias). |
| `services` | `app/[locale]/services/page.tsx:1-14` | Services catalog. |
| `healthcheck` | `app/[locale]/healthcheck/page.tsx` | Health list. |
| `docker` | `app/[locale]/docker/page.tsx:1-128` | Docker containers table. |
| `systemd` | `app/[locale]/systemd/page.tsx` + `[unit]/` | systemd units. |
| `incus` | `app/[locale]/incus/page.tsx` + `provision/` + `[name]/` | Incus wizard. |
| `processes` | `app/[locale]/processes/page.tsx` | Process list. |
| `network` | `app/[locale]/network/page.tsx` | Network interfaces. |
| `alerts` | `app/[locale]/alerts/page.tsx` | Alert rules/history. |
| `agents` | `app/[locale]/agents/page.tsx` + `[slug]/` | Hermes agents. |
| `backups` | `app/[locale]/backups/page.tsx` | Backup list. |
| `scheduler` | `app/[locale]/scheduler/page.tsx` | Systemd timers. |
| `storage` | `app/[locale]/storage/page.tsx` | Mounts/drives. |
| `approvals` | `app/[locale]/approvals/page.tsx` | Pending approvals. |
| `terminal` | `app/[locale]/terminal/page.tsx` | xterm shell. |
| `mail-guardian` | `app/[locale]/mail-guardian/page.tsx` | Mail review queue. |
| `audit` | `app/[locale]/audit/page.tsx:1-56` | Audit log viewer. |
| `admin/*` | `app/[locale]/admin/{services,users,alerts,badges,incus,env-browser,audit,systemd,docker,projects,account}` | Admin UI. |
| `setup` | `app/[locale]/setup/page.tsx` | Legacy — first-time setup is disabled. |

### 2.2 API routes (`packages/dashboard/src/app/api/`)

All API routes use the Next.js App-Router `route.ts` convention. The full
inventory (49 routes) lives under `src/app/api/`:

| Group | Routes (selected) | Notes |
|-------|------------------|-------|
| **Auth & session** | `auth/route.ts:1-75` (POST login, GET session, DELETE logout), `auth/setup/route.ts:1-16` (always `{required: false}`), `auth/password/route.ts:1-20` (always 409 — PAM owns passwords). | All backed by `lib/auth.ts`. |
| **Services catalog** | `services/route.ts:1-363` (GET, POST, PATCH, DELETE; CHECK_TYPES = http/tcp/docker/systemd/process), `services/[slug]/route.ts`, `services/uptime/route.ts/`. | The single source of truth for the registry. |
| **System / metrics** | `system/route.ts`, `processes/route.ts`, `network/route.ts`, `health/route.ts`, `layout/route.ts`. | Driven by `hostExecFile`. |
| **systemd** | `systemd/route.ts:1-...` (list), `systemd/actions/route.ts:1-79` (start/stop/restart, **admin only**). | Calls `executeRootCommand`. |
| **Docker** | `docker/route.ts:1-...`, `docker/actions/route.ts:1-115` (start/stop/restart/pull/prune, **admin only**), `docker/networks/route.ts`, `docker/logs/route.ts`. | |
| **Incus** | `incus/route.ts:1-86`, `incus/instances/route.ts:1-60`, `incus/instances/[name]/route.ts`, `incus/instances/[name]/provision/route.ts`, `incus/instances/[name]/validate/route.ts`, `incus/instances/[name]/provision/status/route.ts`, `incus/create/route.ts`, `incus/actions/route.ts`, `incus/images/route.ts`, `incus/settings/route.ts`, `incus/ai/analyze/route.ts`, `incus/ai/models/route.ts`, `incus/[name]/route.ts`, `incus/[name]/shell/route.ts`. | 14 routes; 6 admin-gated. |
| **AI / chat** | `ai/chat/route.ts:1-219` (streaming, admin-gated, rate-limited). | Streams via Vercel AI SDK → 9Router. |
| **Alerts** | `alerts/route.ts`, `alerts/operational/route.ts`. | |
| **Audit** | `audit/route.ts:1-84` (paginated, admin-gated), `audit/verify/route.ts:1-65` (chain verify via `@cortexos/audit`), `audit/events/[eventType]/route.ts:1-...` (append via `@cortexos/audit`). | Hash-chained, append-only. |
| **Root helper** | `root-helper/commands/route.ts:1-61` (admin-only). | UNIX-socket client → root helper. |
| **Env browser** | `env-browser/route.ts:1-281` (admin-only POST, auth-only GET; uses confirmation token for reveal/write). | The "secrets-from-VPS" UI. |
| **Admin** | `admin/users/route.ts`, `admin/services/route.ts`. | |
| **Misc** | `chat-sessions/route.ts`, `scheduler/route.ts`, `terminal/route.ts`, `projects/route.ts` + `[slug]/routes/route.ts`, `mail-guardian/route.ts` + `mail-guardian/accounts/route.ts` + `mail-guardian/reviews/route.ts`, `approvals/route.ts`, `badges/route.ts`, `agents/route.ts` + `agents/[slug]/files/...`. | |

**Auth gates used:** every privileged route calls `requireAuth` (401) and/or
`requireAdmin` (403 + audit). See `lib/auth.ts:179-211` for `requireAdmin`
with the H-1 audit-on-deny pattern.

### 2.3 Server actions and components

The dashboard uses App-Router **server actions** sparingly (no `actions.ts` in
the app tree; the bulk of mutations are POST routes). Server actions DO exist
in the `incus/instances/[name]/provision/status` and admin routes via
`revalidatePath`, but the heavy lifting is in `route.ts` handlers.

UI components (under `packages/dashboard/src/components/`):

- `sys-pilot/` — 20+ components ported from the sys-pilot reference:
  `DataTable`, `PageHeader`, `StatusHero`, `StatusBadge`, `TechIcon`,
  `CommandPalette`, `ConfirmDialog`, `KeyboardShortcuts`, `LogStream`,
  `LogViewer`, `MetricCard`, `Sparkline`, `GaugeRadial`, `NetworkTopology`,
  `IncidentTimeline`, `IncidentToaster`, `KeyValueList`, `EmptyState`,
  `CodeBlock`, `CopyButton`, `AreaTrend`, `DetailDrawer`,
  `dashboard-shell.tsx`, `NavConfig.ts`, etc. (`packages/dashboard/src/components/sys-pilot/`).
- `ui/` — shadcn primitives (button, card, dialog, popover, sonner, table,
  tabs, etc.). 36 files in `components/ui/`.
- `layout/`, `admin/`, `agents/`, `apps/`, `cortex/`, `docker/`,
  `healthcheck/`, `incus/`, `services/`, `widgets/`, `notifications/`,
  `mobile/`, `icons/` — feature-specific and shared widgets.
- `dashboard-shell.tsx`, `dashboard-widgets.tsx`, `favorites-bar.tsx`,
  `gauge.tsx`, `live-chart.tsx`, `net-chart.tsx`, `query-provider.tsx`,
  `service-logo.tsx`, `skeleton.tsx`, `tech-icon.tsx` — cross-feature helpers.

### 2.4 Library code (`packages/dashboard/src/lib/`)

The most critical subdirectories and their roles:

| Path | Role |
|------|------|
| `lib/auth.ts:1-211` | PAM authentication, session cookie, `requireAuth`/`requireAdmin`, group-based admin gate. |
| `lib/pam.ts:1-33` | `authenticatePam()` via the native `authenticate-pam` addon. |
| `lib/host-exec.ts:1-41` | `hostExec` / `hostExecFile` — runs commands on the host (or `nsenter`'s PID 1 in a container). |
| `lib/socket-server.ts:1-208` | Custom Socket.IO server: services/system/processes/network/alerts push + retention loop. |
| `lib/socket.ts:1-19` | Client-side socket.io-client factory. |
| `lib/root-helper/client.ts:1-80` | UNIX-socket client to `/run/cortexos/dashboard-helper.sock`. |
| `lib/root-helper/executor.ts:1-124` | `executeRootCommand()` — wraps client + creates/finishes `dashboard_command_audit` row. |
| `lib/runtime/host-ops.ts:1-113` | `systemdAction()` and `dockerAction()` — allowlist + audit + log. |
| `lib/secrets/allowlist.ts:1-162` | Path allowlist: `/opt/cortexos/.secrets/`, `/opt/cortexos/stacks/`, `/etc/systemd/system/*.d/`. |
| `lib/secrets/vps-reader.ts:1-207` | Env-file reader; masks secret keys; raw reveal is admin-only. |
| `lib/secrets/vps-writer.ts:1-255` | Env-file writer (lockfile, atomic rename, before/after SHA-256). |
| `lib/validation/index.ts:1-128` | Zod boundary validation, `parseInput()` helper, audit query schema, approval schema. |
| `lib/agents/scanner.ts:1-246` | Hermes profile scanner (`/opt/cortexos/hermes/profiles/**`). |
| `lib/ai/confirmation-token.ts:1-278` | HMAC-SHA256 confirmation tokens (issue/verify/consume). |
| `lib/ai/tools.ts:1-496` | Vercel AI SDK tool registry (vps_status, env_read, env_diff_propose, service_restart, docker_action). |
| `lib/ai/provider-resolver.ts:1-124` | 9Router (OpenAI-compatible) provider. |
| `lib/ai/session-binding.ts:1-27` | `deriveCortexSessionId()` — server-bound session id for HMAC payload. |
| `lib/ai/incus-analysis.ts:1-136` | AI advice for the Incus wizard (3 touchpoints, all return `null` on failure). |
| `lib/incus/instance-config.ts:1-170` | `IncusInstanceConfig` shape + `validateConfigShape` + `buildScriptArgv`. |
| `lib/incus/config-schema.ts:1-44` | Zod schema for the above. |
| `lib/incus/preflight.ts:1-107` | Deterministic pre-flight: name, image, pool, bridge, hermes secret. |
| `lib/db/client.ts:1-58` | Lazy pg pool; throws on missing `DB_PASSWORD`. |
| `lib/db/admin.ts:1-102` | `pam_users`, `admin_sessions` CRUD. |
| `lib/db/service.ts:1-168` | `services` table CRUD (the catalog). |
| `lib/db/alerts.ts:1-260` | `alert_rules`, `alert_history`, `alerts` (operational) — three different concerns in one file. |
| `lib/db/dashboard-audit.ts:1-234` | `agent_gateway_audit` writes (append-only). |
| `lib/db/dashboard-command-audit.ts:1-120` | `dashboard_command_audit` lifecycle. |
| `lib/db/health-log.ts:1-100` | `service_health_log` writes + uptime aggregates. |
| `lib/db/chat-sessions.ts:1-127` | `chat_sessions` (per-user) with secret redaction. |
| `lib/db/incus-instances.ts:1-137` | `incus_instances` CRUD (wizard-saved configs). |
| `lib/db/messaging-routes.ts:1-111` | `messaging_routes` CRUD (15 platforms). |
| `lib/db/projects.ts:1-137` | `projects` CRUD. |
| `lib/db/badges.ts`, `lib/db/service-badges.ts` | Catalog + service↔badge join. |
| `lib/db/config-kv.ts:1-44` | `config` key/value accessors. |
| `lib/db/action-log.ts:1-54` | `action_log` (UI-initiated host actions). |
| `lib/db/migrate.ts:1-80` | Dev-time migration runner (TS twin of `scripts/migrate.js`). |
| `lib/types.ts`, `lib/utils.ts` | Type re-exports + `cn()`/`formatBytes()`. |
| `lib/sys-pilot/types.ts:1-137` | Stable UI contract types (Service, AlertRule, etc.). |
| `lib/sys-pilot/format.ts`, `lib/sys-pilot/status.ts` | Formatting + status color helpers. |
| `lib/api.ts:1-164` | HTTP client wrapping `/api/*` for the UI (typed). |
| `lib/theme-presets.ts:1-30` | Preset constants (cortex/teal/emerald/amber). |

---

## 3. Backend surface the new dashboard can call or replace

### 3.1 Auth / session model

**No in-app user store. Authentication is delegated to Linux PAM.**

- `lib/auth.ts:109-123` — `authenticateUser(username, password)`:
  1. `authenticatePam()` (native libpam via `authenticate-pam`).
  2. `getOrCreatePamUser()` upserts a `pam_users` row.
  3. `checkGroupMembership()` shells out `id -Gn $USER` and checks for
     `cortexos-admin` or `sudo` (`lib/auth.ts:15,22-38`).
  4. Returns `{...pamUser, is_admin}`.
- Sessions: random 32-byte hex token, 7-day TTL
  (`lib/auth.ts:13-14,40-52,54-66`).
- Cookie: `session_token`, `httpOnly: true`, `secure` derived from
  `DASHBOARD_ORIGIN` or `COOKIE_SECURE` (`lib/auth.ts:16,54-66`).
- `lib/auth.ts:179-211` — `requireAdmin(request, {tool})` returns 403 and
  **inserts an audit row** on deny (best-effort, never blocks the deny).
- `lib/auth.ts:96-98` — `auth` is an alias for `getCurrentSession()` for
  `react-doctor` compat.
- **There is no in-app password reset / change.** `api/auth/password/route.ts:1-20`
  always returns 409 with "manage password on the host" — `api/auth/setup/route.ts:1-16`
  always returns `{required: false}` — there is no first-time setup.

**Env vars consumed by auth path (besides `DB_*`):**
- `DASHBOARD_ORIGIN` (CORS allowlist for Socket.IO) — `server.ts:18-23`.
- `COOKIE_SECURE` — `lib/auth.ts:16`.
- `CORTEX_CONFIRMATION_HMAC_SECRET` — `lib/ai/confirmation-token.ts:18-30`.
- `NINEROUTER_BASE_URL` + `NINEROUTER_API_KEY` — `lib/ai/provider-resolver.ts:41-53`.

### 3.2 Database

- **PostgreSQL** — `lib/db/client.ts:1-58`. Lazy `Pool`; throws if `DB_PASSWORD`
  is unset. 20-conn pool, 30 s idle, 5 s connect timeout.
- **Migrations** — `scripts/migrate.js:1-100` (CJS, run by `docker-entrypoint.sh:22-23`
  and CI). Sort-safe filename `^[a-zA-Z0-9_-]+\.sql$`. Replaces `<VPS_LAN_IP>`
  placeholder via `os.networkInterfaces()` heuristic
  (`scripts/migrate.js:11-30,76-83`).
- **TimescaleDB extension** is required (`migrations/001_schema.sql:269-287`
  — `CREATE EXTENSION IF NOT EXISTS timescaledb;` for the `audit_log`
  hypertable). If TimescaleDB is missing, fresh installs fail. **The Postgres
  used in production must have the TimescaleDB extension installed.**
- Schema lives in `migrations/` (4 files; rollback dir has 1 file). Total of
  17 tables:
  - `migrations`, `services`, `badges`, `service_badges`, `alerts`,
    `agent_gateway_audit`, `projects`, `messaging_routes`, `pam_users`,
    `admin_sessions`, `service_health_log`, `alert_rules`, `alert_history`,
    `action_log`, `config`, `dashboard_layouts`, `chat_sessions`,
    `incus_instances` (added in 003), `audit_log` (TimescaleDB hypertable,
    added in 001), `pending_approvals` (added in 001).
  - **Plus** `dashboard_command_audit` — referenced in
    `lib/db/dashboard-command-audit.ts:41` but **not present in the
    migration files**. See §11 Finding F-2. The 4 migration files total
    300+262+32+48 = 642 lines of SQL; only 4 files exist. The code expects
    `dashboard_command_audit` to exist.

### 3.3 Service registry schema (`services` table)

`migrations/001_schema.sql:11-38`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `slug` | VARCHAR(64) UNIQUE | |
| `name` | VARCHAR(128) | |
| `kind` | VARCHAR(16) CHECK | `app` / `service` / `docker` / `process` |
| `category` | VARCHAR(64) | |
| `description` | TEXT NULL | |
| `health_url` | VARCHAR(512) default `'#'` | |
| `health_type` | VARCHAR(16) default `'http'` | `http` / `tcp` / `docker` / `process` / `systemd` (see `api/services/route.ts:200-201` and `lib/validation/index.ts:16`) |
| `open_url` | VARCHAR(512) default `'#'` | |
| `env_source` | TEXT NULL | Path to env file (used by `env-browser` for reveal). |
| `status` | VARCHAR(16) default `'unknown'` | `online` / `offline` / `unknown` |
| `last_check_at` | TIMESTAMP NULL | |
| `response_ms` | INTEGER NULL | |
| `uptime_24h` | NUMERIC(5,2) NULL | |
| `icon_type` | VARCHAR(32) default `'auto'` | |
| `icon_color` | VARCHAR(7) NULL | `#rrggbb` |
| `icon_image` | TEXT NULL | data URI or `/uploads/...` |
| `sort_order` | INTEGER default 0 | |
| `is_active` | BOOLEAN default true | Driven by `dynamic-seed.js`. |
| `has_webui`, `show_in_healthcheck`, `show_in_webui` | BOOLEAN | |
| `created_at`, `updated_at` | TIMESTAMP | |

CRUD: `lib/db/service.ts:35-167`. `getAllServices()` filters `is_active = true`
by default.

### 3.4 Real-time / streaming surfaces (Socket.IO)

`lib/socket-server.ts:1-208` (server) + `lib/socket.ts:1-19` (client).

- Path: `/socket.io` (`server.ts:26`).
- CORS: `DASHBOARD_ORIGIN` comma-split, with `localhost` defaults in dev
  (`server.ts:18-23`).
- Auth: cookie-based via `getSessionToken()` then `getSessionByToken()`
  (`lib/socket-server.ts:17,31-35,67-77`).
- Polling intervals (`lib/socket-server.ts:7-14`):
  - `services`: 10 s
  - `system`: 5 s
  - `processes`: 5 s
  - `network`: 5 s
  - `docker`: 10 s
  - `alerts`: 10 s
- Events emitted (all broadcast):
  - `services:status` — re-fetches `GET /api/services?raw=1`
  - `system:metrics` — re-fetches `GET /api/system`
  - `processes:list` — re-fetches `GET /api/processes`
  - `network:stats` — re-fetches `GET /api/network`
  - `docker:status` — `docker ps` every 10 s (`lib/socket-server.ts:46-64`)
  - `alert:triggered` — rule-based alert fired (`lib/socket-server.ts:124-201`)
- **Retention loop** — `runRetentionCleanup()` runs at boot and every 6 h
  (`lib/socket-server.ts:16,37-44,84-85`):
  - `DELETE FROM service_health_log WHERE checked_at < NOW() - INTERVAL '30 days'`
  - `DELETE FROM alert_history WHERE created_at < NOW() - INTERVAL '90 days'`
- **Alert engine** — rule-based, in the same file. Reads `enabled` rules, walks
  service status transitions, and emits `alert:triggered` for `offline` /
  `online` and threshold-based `response_time` events. Persists to
  `alert_history` (`lib/socket-server.ts:124-201`).

> **No standalone realtime surface for the AI chat.** Streaming happens via
> Vercel AI SDK `toUIMessageStreamResponse()` in
> `api/ai/chat/route.ts:201`.

### 3.5 Other interesting tables

- `pam_users`, `admin_sessions` — `lib/db/admin.ts:1-102`.
- `service_health_log` — 30-day retention.
- `alerts` (operational) vs `alert_history` (rule-based) — two distinct
  tables. `lib/db/alerts.ts:1-260`.
- `agent_gateway_audit` — **append-only** by convention. Schema comments
  require `REVOKE UPDATE, DELETE, TRUNCATE` for the `dashboard` role
  (`migrations/001_schema.sql:96-97, 252-262`).
- `audit_log` — TimescaleDB **hypertable**, hash-chained, optional Sigstore
  Rekor anchor (`migrations/001_schema.sql:269-294`).
- `incus_instances` — wizard-saved configs (`migrations/003_incus_instances.sql`).
- `dashboard_command_audit` — created by `lib/db/dashboard-command-audit.ts:41-62`
  but **no migration creates this table** (see §11 F-2).
- `dashboard_layouts` — per-user widget layouts (table present, but the
  current overview page writes to `localStorage` instead — see §11 F-1).
- `chat_sessions` — per-user chat state with TTL and size cap
  (`migrations/001_schema.sql:208-216`).

### 3.6 Secrets layout

- **Production env file:** `/opt/cortexos/.secrets/dashboard.env` (per
  `dashboard.env.example:1-3`, `scripts/provision-vps.sh:64-67,141-184`).
  Owner `root:root`, mode `0600`.
- **Env vars:** `PORT=3080`, `NODE_ENV=production`, `HOSTNAME=0.0.0.0`,
  `DASHBOARD_ORIGIN`, `DB_HOST/PORT/NAME/USER/PASSWORD`,
  `CORTEX_MASTER_KEY` (32-byte hex, see `dashboard.env.example:6-22`),
  optional `CORTEX_INTERNAL_TOKEN`, Hermes scan paths
  (`HERMES_BASE`, `HERMES_PROFILES_ROOT`, `AGENT_SCAN_PATHS`), `SSH_USER`.
- **Docker env file path inside container:** the
  `docker-entrypoint.sh:1-33` script does **not** read `.secrets/dashboard.env`
  directly; it expects env vars to be passed in by the orchestrator
  (docker compose / caddy). The host-side provisioner writes the env file
  (`scripts/provision-vps.sh:161-184`).
- **Secret allowlist** (`lib/secrets/allowlist.ts:38-46`):
  - `/opt/cortexos/.secrets/`
  - `/opt/cortexos/stacks/`
  - `/etc/systemd/system/*.d/` (overrides only, never the `.service` file
    itself; `isSystemdOverride` at `lib/secrets/allowlist.ts:68-74`).
- **No in-app secret storage** — the dashboard only reads host files via the
  allowlist. `CORTEX_MASTER_KEY` is **declared** in `dashboard.env.example:22`
  but the production code does not yet reference it. It's reserved for
  future use (e.g. encrypting future per-user tokens). **There is no
  consumer of `CORTEX_MASTER_KEY` in the current code base.** §11 F-7.

---

## 4. CLI / system-integration surface

The production CLI is split across `scripts/` and `scripts/ops/`. None of
`scripts/ops/cortex-dashboard-build.sh`, `scripts/ops/cortex-render-units.sh`,
or `templates/systemd/cortex-dashboard.service` exist in this worktree.
**See §11 F-3.**

### 4.1 `scripts/provision-vps.sh` (220 lines, fully on `main`)

The single host-bootstrap script. Responsibilities (with line citations):

- Detect OS family via `scripts/pkg.sh` (`provision-vps.sh:38-49`).
- Reject root (`provision-vps.sh:59-62`).
- Install Docker Engine + Compose plugin (idempotent) (`provision-vps.sh:84-107`).
- Ensure `cortex-net` Docker network (`provision-vps.sh:109-111`).
- Start `postgresql` and create `dashboard` role + `cortex_dashboard` DB
  (`provision-vps.sh:113-139`).
- Scaffold `/opt/cortexos/{secrets,dashboard,backups/dashboard,.secrets}`
  (`provision-vps.sh:141-146`).
- Decrypt SOPS+age encrypted templates via
  `scripts/secrets-decrypt.sh` (prereq: 12a-sops-bootstrap.md) (`provision-vps.sh:148-159`).
- Write `dashboard.env` from template if missing
  (`provision-vps.sh:161-184`).
- Optionally install Caddy and open 80/443 (`provision-vps.sh:186-201`).
- Bring up `stacks/cortex-dashboard` via `docker compose up -d --build`
  (`provision-vps.sh:203-210`).

### 4.2 `scripts/migrate.js` (100 lines, CJS)

Standalone, doesn't import from `src/`. Reads `migrations/*.sql`, applies each
un-applied one in order, and records in the `migrations` table
(`scripts/migrate.js:67-90`).

### 4.3 `scripts/dynamic-seed.js` (146 lines, CJS)

Spoke-aware activation of the services catalog. Reads
`/run/cortexos/setup-state.json` or `/opt/cortexos/.secrets/.setup-state.json`
for `completed_spokes`, then maps spoke IDs → service slugs (the
`SPOKE_TO_SERVICES` table at `dynamic-seed.js:9-41`). Sets `is_active`,
`has_webui`, `show_in_webui`, `show_in_healthcheck`, and calls
`cortex_set_service_urls($1)` (Postgres function defined in
`002_seed.sql:130-262`) with the inferred public base URL.

### 4.4 `scripts/ops/cortex-backup.sh` + `scripts/ops/cortex-auto-update.sh`

OS-level backup/auto-update scripts. Both use the distro-agnostic
`scripts/pkg.sh` dispatcher and operate on the **Compose stack** path
(`stacks/cortex-dashboard/`), not on a systemd unit.

### 4.5 The missing pieces the brief assumes

The task brief asks about `scripts/ops/cortex-dashboard-build.sh` and
`scripts/ops/cortex-render-units.sh`. **Neither exists on `main`.** The
unit file `templates/systemd/cortex-dashboard.service` also does not exist
on `main`. These are artifacts of the **legacy**
`packages/cortex-dashboard/` (untracked, see §0) that the current
Docker-Compose deploy path replaced. The README + CHANGELOG + commit
history (`5766abb`, `6f31f95`, `7ea3ef9`, `68ba13b`) make it clear the
move to Docker Compose is intentional. The stale systemd docs in
`.github/workflows/ci.yml:55-56` ("compose" job's comment) and in
`packages/dashboard/docker-compose.yml:1-3` ("Dashboard runs as
cortex-dashboard.service") have not been updated to reflect this.

---

## 5. CI / CD shape

### 5.1 `.github/workflows/`

| File | Status | Purpose |
|------|--------|---------|
| `ci.yml` | Active | `dashboard` (lint + types + test + build), `shell` (shellcheck + bash -n), `compose` (validates local-db compose). **Does not run the dashboard in a container.** |
| `distro-matrix.yml` | Active (presumed) | OS matrix for shell scripts. |
| `schema-check.yml` | Active (presumed) | Validates SQL migrations. |
| `secrets-scan.yml` | Active (presumed) | Prevents secret commits. |
| `release.yml` | Active (presumed) | Release pipeline. |
| `release-paperclip-adapter.yml` | Active (presumed) | Per-package release. |
| `markdown-lint.yml` | Active (presumed) | Docs lint. |
| `gate-enforcement.yml` | Active (presumed) | PR gate. |
| `ai-review-request.yml` | Active (presumed) | Triggers AI PR review. |
| `codeql.yml` | Active (presumed) | Security scan. |
| `agent-mention-router.yml` | **DEPRECATED** (`agent-mention-router.yml:1-3`) | Manual-trigger only. |
| `workflow-pipeline.yml` | Active (presumed) | Pipeline orchestration. |

`ci.yml` runs the dashboard build but the build itself does not publish a
container image — there is no `image:` step. The image is built on the VPS
during `provision-vps.sh` or by a manual operator action.

### 5.2 Renovate / Dependabot

- `renovate.json:1-5` — `extends: config:recommended`. No custom rules.
- `.github/dependabot.yml` — present (GitHub-native).

### 5.3 Pre-commit / hooks

- Husky is **not** in `packages/dashboard/package.json`. The Dockerfile uses
  `npm install --ignore-scripts` to avoid husky/pnpm-workspace conflicts
  (`Dockerfile:1-110` — referenced via `provision-vps.sh` build notes).
- No `lefthook.yml` / `pre-commit` config in the worktree root.

---

## 6. Deployment / runtime expectations

### 6.1 The actual production deploy path (from tracked code)

- **Dashboard runs as a Docker Compose service** under
  `stacks/cortex-dashboard/` (not as a systemd unit).
  - `scripts/provision-vps.sh:203-210` runs
    `cd stacks/cortex-dashboard && sudo docker compose up -d --build`.
  - The dashboard image is built from `packages/dashboard/Dockerfile:1-110`
    with a multi-stage build: builder (Node 22) → runtime (Node 22-slim +
    dumb-init + postgresql-client + curl + ca-certificates), listening on
    `PORT=3080` (`Dockerfile:74-79`).
  - The container entrypoint is `docker-entrypoint.sh:1-33`, which waits for
    Postgres, runs `node scripts/migrate.js`, runs `node scripts/dynamic-seed.js`
    (best-effort), then `exec node server.js`.
  - `docker-compose.yml:1-25` (root level) only runs Postgres for local dev
    (profile `local-db`). It is **not** used in production.
- **Reverse proxy:** Caddy, installed optionally by
  `provision-vps.sh:186-201`. Caddyfile snippets per-service are
  documented in the operator prompts (`prompts/tools/13-caddy.md`,
  referenced by the AGENTS.md memory context).
- **Port:** `3080` (env-driven; `dashboard.env.example:6`,
  `server.ts:7`, `Dockerfile:77`).
- **No host network requirement** (the Docker compose stack uses a named
  network, `cortex-net`, created at `provision-vps.sh:109-111`).
- **Socket.IO path:** `/socket.io` (`server.ts:26`).

### 6.2 What the brief got wrong

- Brief said: "systemd-native via `cortex-dashboard.service`".
- Reality: Docker-Compose, via `stacks/cortex-dashboard/`.
- The unit file `templates/systemd/cortex-dashboard.service` does not exist
  on `main`. The legacy `packages/cortex-dashboard/CLAUDE.md` documents
  the old story; the new code's docs haven't been updated (§11 F-3).
- The `ci.yml:55-56` comment still says "the dashboard itself runs as the
  native cortex-dashboard.service unit" — also stale.

### 6.3 Health endpoint

- `GET /api/health` is implemented (file present at
  `packages/dashboard/src/app/api/health/route.ts`). Not read in this audit
  pass; used by `docker-compose.yml:17` healthcheck and `provision-vps.sh:219`.

---

## 7. Security constraints

The dashboard's threat model is "the operator on the Tailscale tailnet is
trusted; the dashboard is the only entry point for that operator". Hard
constraints:

### 7.1 Native addon: `authenticate-pam`

- Listed in `package.json:34` (`"authenticate-pam": "^1.0.2"`) and in
  `next.config.ts:22` as a `serverExternalPackages` entry.
- The module name is assembled at runtime to defeat bundler tracing
  (`lib/pam.ts:24-32`): `["authenticate","pam"].join("-")`.
- Comment at `lib/pam.ts:1-8` explains the require is from `cwd()` because
  the production build is an esbuild CJS bundle.

### 7.2 Linux PAM (no in-app passwords)

- No `users.password_hash` column. No `bcrypt` usage in the app
  (bcryptjs is in `package.json:35` for a placeholder — verify whether
  it's still needed; the only current use is the legacy
  `change-admin-password.sh` script at `scripts/change-admin-password.sh:1`).
- `lib/auth.ts:109-123` — PAM is the only authenticator.
- `api/auth/password/route.ts:1-20` — POST always returns 409 with
  "manage password on the host".

### 7.3 Admin via host group membership

- `lib/auth.ts:15,22-38` — `ADMIN_GROUPS = ["cortexos-admin", "sudo"]`.
- `checkGroupMembership()` shells `id -Gn $USER` (2 s timeout, swallows
  errors → returns `false`).
- `is_admin` is computed at login and **persisted on the session row**
  (`migrations/001_schema.sql:139-146` — `admin_sessions.is_admin`).
  Revoking a group does **not** invalidate existing sessions.

### 7.4 Append-only audit (H-3)

- `agent_gateway_audit` has no UPDATE/DELETE methods exported from
  `lib/db/dashboard-audit.ts:1-234`. Schema explicitly revokes UPDATE,
  DELETE, TRUNCATE for the `dashboard` role
  (`migrations/001_schema.sql:252-262`).
- `audit_log` is a TimescaleDB hypertable with a `chain_hash` column
  (`migrations/001_schema.sql:269-294`). Verification endpoint at
  `api/audit/verify/route.ts:1-65` wraps `@cortexos/audit#verifyChain`.

### 7.5 Confirmation tokens (HMAC)

- `lib/ai/confirmation-token.ts:1-278` — issue/verify/consume, 5-min TTL.
- `lib/ai/session-binding.ts:1-27` — `deriveCortexSessionId(userId, token)`
  is the canonical, server-bound session id; **client-supplied sessionId
  is never used in the HMAC payload** (see comment in
  `api/ai/chat/route.ts:189-192`).
- Token consumption is **in-memory**, single-process only. Documented as
  v1.1 follow-up (`confirmation-token.ts:6-10`).
- `env-browser` `POST /api/env-browser` requires both `requireAdmin` and
  a confirmation token bound to `toolName: "env.write"` and
  `argsHash: sha256(path)` (`api/env-browser/route.ts:185-281`).
- `env-browser` `GET ?reveal=true` requires both `requireAuth` and a
  confirmation token bound to `toolName: "env_reveal"` and
  `argsHash: sha256(path|sorted(keys))` (`api/env-browser/route.ts:64-153`).

### 7.6 Secret path allowlist

- `lib/secrets/allowlist.ts:1-162` — `/opt/cortexos/.secrets/`,
  `/opt/cortexos/stacks/`, `/etc/systemd/system/*.d/` (overrides only).
- Symlink resolution + `..` rejection + NUL-byte rejection
  (`allowlist.ts:101-135`).

### 7.7 Headers (CSP, HSTS, X-Frame-Options)

- `next.config.ts:7-21`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; ...; connect-src 'self' ws: wss:; frame-ancestors 'none';`

### 7.8 Rate limits (in-memory)

- `api/ai/chat/route.ts:41-81` — 60 req / 15 min per user, 300 / 15 min
  global. In-memory; per-process.
- `lib/ai/tools.ts:54-95` — per-tool sliding window
  (`rate_limit_per_15min` from `tools-data/policy.json`).
- Both are documented as v1.1 follow-ups requiring Redis/Valkey for
  multi-worker deploys.

### 7.9 SQL injection posture

- All DB access goes through `pg` parameterized queries. No string
  concatenation of user input into SQL anywhere in `lib/db/`. Verified by
  inspection of all `lib/db/*.ts` files.

### 7.10 Subprocess / shell escape posture

- `lib/host-exec.ts:9-18` — `hostExec(cmd)` uses `execSync(cmd)` (shell
  expansion); `hostExecFile(bin, args)` uses `execFile` (no shell).
  Callers that go through `runtime/host-ops.ts` (systemd/docker) and
  `root-helper/executor.ts` (root-helper) all use `hostExecFile`-style
  `argv` arrays — no shell. Service-name allowlists
  (`SYSTEMD_NAME_RE`, `DOCKER_NAME_RE`, `SAFE_NAME_RE` in
  `lib/runtime/host-ops.ts:11-15`) are checked before dispatch.
- `lib/socket-server.ts:49-58` — the `docker ps` shell is the only
  remaining `execSync` of a string template, and the string is a fixed
  template (no user input). Acceptable.

---

## 8. Reusable module list

These modules in the existing dashboard should be **imported or wrapped** by
the SvelteKit replacement, **not re-implemented**. Each entry has a one-line
rationale and a citation.

### 8.1 Auth / session (REUSE — hard to port, high value)

- `lib/auth.ts:1-211` — `authenticateUser`, `createUserSession`,
  `setSessionCookie`, `getCurrentSession`, `requireAuth`, `requireAdmin`,
  `logout`. **No replacement possible without re-implementing PAM.**
- `lib/pam.ts:1-33` — `authenticatePam`. **Native binding. Cannot be
  re-implemented in SvelteKit without the same native module.**

### 8.2 DB client + table CRUD (REUSE)

- `lib/db/client.ts:1-58` — `getPool()`, `query<T>()`, `queryOne<T>()`,
  `execute()`. Reuse as-is; works in any Node.js runtime.
- `lib/db/admin.ts:1-102` — `pam_users`, `admin_sessions` queries.
- `lib/db/service.ts:1-168` — `services` CRUD.
- `lib/db/alerts.ts:1-260` — `alert_rules`, `alert_history`, `alerts`.
- `lib/db/health-log.ts:1-100` — `service_health_log` writes, uptime aggregates.
- `lib/db/incus-instances.ts:1-137` — `incus_instances` CRUD.
- `lib/db/messaging-routes.ts:1-111` — `messaging_routes` CRUD.
- `lib/db/projects.ts:1-137` — `projects` CRUD.
- `lib/db/badges.ts`, `lib/db/service-badges.ts` — `badges` + join table.
- `lib/db/config-kv.ts:1-44` — `config` key/value.
- `lib/db/action-log.ts:1-54` — `action_log`.
- `lib/db/chat-sessions.ts:1-127` — `chat_sessions` (with redaction).
- `lib/db/dashboard-audit.ts:1-234` — `agent_gateway_audit` writes.
- `lib/db/dashboard-command-audit.ts:1-120` — `dashboard_command_audit`
  lifecycle. **Missing migration — see §11 F-2.**

### 8.3 Validation (REUSE)

- `lib/validation/index.ts:1-128` — `parseInput()`, `auditViewerQuerySchema`,
  `approvalSignalInputSchema`, `notifyTestInputSchema`, `isoDateString`,
  plus legacy constants (`SLUG_RE`, `VALID_HEALTH_TYPES`, etc.).
- `lib/incus/config-schema.ts:1-44` — `incusInstanceConfigSchema` (zod).

### 8.4 Secrets / env-file IO (REUSE — security-sensitive)

- `lib/secrets/allowlist.ts:1-162` — path allowlist with symlink resolution.
- `lib/secrets/vps-reader.ts:1-207` — `readEnvFile`, `readEnvFileRaw`,
  `parseEnvFile`, `isSecretKey`, `applyMask`.
- `lib/secrets/vps-writer.ts:1-255` — `writeEnvFile` (lockfile +
  atomic rename + before/after SHA-256).

### 8.5 Host-action layer (REUSE)

- `lib/host-exec.ts:1-41` — `hostExec`, `hostExecFile`.
- `lib/runtime/host-ops.ts:1-113` — `systemdAction()`, `dockerAction()`
  with name allowlist + audit + log.
- `lib/root-helper/client.ts:1-80` — UNIX-socket client.
- `lib/root-helper/executor.ts:1-124` — `executeRootCommand()` with audit
  create/finish.

### 8.6 AI tool registry (REUSE — already provider-agnostic)

- `lib/ai/provider-resolver.ts:1-124` — `getNineRouterModel()`.
- `lib/ai/confirmation-token.ts:1-278` — `issueConfirmationToken`,
  `verifyAndConsume`, `setTokenConsumedStore`.
- `lib/ai/session-binding.ts:1-27` — `deriveCortexSessionId`.
- `lib/ai/incus-analysis.ts:1-136` — `analyzeTarget`, `aiPreflightAdvice`,
  `aiPostcreateAdvice` (each returns `null` on failure, never blocks).
- `lib/ai/tools.ts:1-496` — `getAllTools(ctx)` returning the tool registry.
  The SvelteKit app will need its own AI UI, but the registry can be
  imported and called from SvelteKit server endpoints.
- `lib/ai/tools-data/policy.json` — tool policy (class, rate limits, cooldowns).

### 8.7 Real-time (REUSE — replace, or REPLACE)

- `lib/socket-server.ts:1-208` — Socket.IO server, retention loop, alert
  engine. **SvelteKit will not use Socket.IO; needs replacement** with
  either Server-Sent Events (SSE) or a separate WebSocket process. The
  **data flow** is reusable: poll `/api/services?raw=1`, `/api/system`,
  `/api/processes`, `/api/network`, `docker ps`, then push. See §11 F-4.
- `lib/socket.ts:1-19` — client factory. Replace with SSE / native WS in SvelteKit.

### 8.8 Migration runner (REUSE)

- `scripts/migrate.js:1-100` — CJS runner, doesn't import from `src/`. The
  SvelteKit package should vendor its own copy (or this one) and call it
  from its own entrypoint. **It must be re-run for any new migration
  files** — the SvelteKit package must ship its own migration directory.

### 8.9 Stable UI contract types (REUSE)

- `lib/sys-pilot/types.ts:1-137` — `Service`, `SystemData`,
  `ProcessInfo`, `NetworkData`, `AlertRule`, `AlertHistory`,
  `DockerContainer`, `DockerImage`, `DockerVolume`, `DockerNetwork`,
  `IncusInstance`, `IncusImage`, `SystemdUnit`, `ApprovalRequest`,
  `AuditEntry`, `Badge`, `PamUser`, `Project`, `Agent`, `MailReview`.
  These are the **stable contract** that the UI is built against. The
  SvelteKit app should mirror them.

### 8.10 Hermes agent scanner (REUSE)

- `lib/agents/scanner.ts:1-246` — `scanAgents()`, `getAgentFiles()`,
  `readAgentFile()`, `writeAgentFile()`. Talks to the host filesystem
  (`/opt/cortexos/hermes/profiles/`); no in-app state.

### 8.11 Incus wizard logic (REUSE)

- `lib/incus/instance-config.ts:1-170` — `IncusInstanceConfig` shape,
  `validateConfigShape()`, `buildScriptArgv()`, `redactConfig()`.
- `lib/incus/preflight.ts:1-107` — `runPreflight()`.

### 8.12 Theme + i18n constants (REUSE)

- `lib/theme-presets.ts:1-30` — `PRESETS`, `DEFAULT_PRESET`, `PRESET_COOKIE`.
- `messages/{en,es,pt-br}.json` — locale files. The SvelteKit app can
  re-use the JSON shape; only the loader changes.

### 8.13 Internal packages (REUSE)

- `@cortexos/audit` (`packages/cortex-audit/src/index.js:1-...`) —
  hash-chained audit (`append`, `verifyChain`, `setPool`,
  `payloadHashOf`, `chainHashOf`). Used by `api/audit/verify/route.ts`
  and `api/audit/events/[eventType]/route.ts`.

### 8.14 Things the new SvelteKit app should REPLACE

- All of `src/app/[locale]/**` (Next.js App Router pages).
- All of `src/components/sys-pilot/**` (port from React to Svelte).
- All of `src/components/ui/**` (port shadcn primitives).
- `src/lib/api.ts:1-164` (HTTP client wrapper — replace with a SvelteKit
  client that calls the same `/api/*` paths).
- `src/hooks/use-socket.ts` (Socket.IO → SSE / WS).
- `src/lib/theme-presets.ts` consumption (works as-is; the consumer
  changes).

### 8.15 Things the new SvelteKit app can OBSOLETE

- The `[locale]` segment — the SvelteKit app can pick a default
  locale + use route segments if needed; nothing in the API requires the
  locale prefix.
- `src/lib/i18n/{routing,request}.ts` and the `next-intl` dependency.
- The `next.config.ts` header config — the SvelteKit adapter or
  reverse-proxy will set those.
- `src/proxy.ts` (a small Next.js-specific E2E proxy test helper).

---

## 9. Risky-area list

These are areas the new dashboard MUST keep identical semantics on, or
break observable behavior / compliance posture.

| # | Area | File(s) | Why it's risky |
|---|------|---------|----------------|
| R-1 | **PAM authentication** | `lib/pam.ts:1-33`, `lib/auth.ts:109-123` | Native binding; subtle cwd-based `createRequire` workaround at `lib/pam.ts:9`. If the SvelteKit build doesn't have the same CWD layout, the require fails. |
| R-2 | **`serverExternalPackages` for native modules** | `next.config.ts:22` — `ssh2`, `authenticate-pam` | SvelteKit + adapter-node needs an equivalent. The dashboard uses `ssh2` for Incus shell sessions (`api/incus/[name]/shell/route.ts`). |
| R-3 | **Path allowlist + symlink resolution** | `lib/secrets/allowlist.ts:101-150` | If not preserved verbatim, env-browser writes can leak outside the allowlist. The SvelteKit app MUST copy the algorithm — do not just relax it. |
| R-4 | **Append-only audit (`agent_gateway_audit`)** | `migrations/001_schema.sql:252-262`, `lib/db/dashboard-audit.ts:1-234` | Schema explicitly revokes UPDATE/DELETE/TRUNCATE for the `dashboard` role. If the SvelteKit role gets different grants, the audit loses tamper-evidence. |
| R-5 | **Confirmation token HMAC payload** | `lib/ai/confirmation-token.ts:155-201`, `lib/ai/session-binding.ts:17-27` | Payload includes `userId` so a leaked `sessionId` can't replay across users. The exact field order in `canonicalMessage` (`confirmation-token.ts:159-168`) is the wire format. Changing the order breaks every issued token. |
| R-6 | **Cookie + Socket.IO auth** | `lib/auth.ts:13-16,54-66`, `lib/socket-server.ts:17,31-35,67-77` | The Socket.IO server checks the `session_token` cookie. If the SvelteKit app moves to SSE, the auth check must still gate on the same cookie. |
| R-7 | **`CORTEX_MASTER_KEY`** | `dashboard.env.example:22` | Declared but **unused** today. Future code is expected to use it for at-rest encryption. The SvelteKit app must not start using it in plaintext form (only as a key for AES-GCM or similar). |
| R-8 | **`CORTEX_CONFIRMATION_HMAC_SECRET`** | `lib/ai/confirmation-token.ts:18-30` | Test-only insecure fallback. If the SvelteKit app's test runner is not Vitest, the fallback won't trigger and a missing secret will throw at runtime. |
| R-9 | **Timezone / `<VPS_LAN_IP>` placeholder** | `scripts/migrate.js:11-30,76-83` | Migrations reference `<VPS_LAN_IP>` in `002_seed.sql`; the runner rewrites it. The SvelteKit migration runner must do the same. |
| R-10 | **DB role privileges** | `migrations/001_schema.sql:96-97, 252-262` | The `dashboard` role is created externally and gets INSERT/SELECT on `agent_gateway_audit` only. If the new app uses a different role name, every schema grant block must be re-applied. |
| R-11 | **ConfirmDialog / destructive actions** | `api/docker/actions/route.ts:21-113`, `api/systemd/actions/route.ts:15-77` | All destructive actions require `requireAdmin` and write `action_log`. The new SvelteKit app must keep the admin gate — these mutate the host. |
| R-12 | **TimescaleDB extension** | `migrations/001_schema.sql:269-287` | The `audit_log` hypertable depends on TimescaleDB. If the SvelteKit deploy uses a Postgres without TimescaleDB, the migration fails. |
| R-13 | **Chat-session secret redaction** | `lib/db/chat-sessions.ts:29-51` | `SECRET_KEY_RE` masks values on insert. If the SvelteKit app skips this, secrets can leak into the chat history. |
| R-14 | **Image upload to `public/uploads/`** | `api/services/route.ts:168-181` | Saves base64 data URIs to `public/uploads/`. Path is `process.cwd() + "public/uploads"`. SvelteKit adapter will have a different writable root — must port carefully. |
| R-15 | **`CORTEX_INTERNAL_TOKEN` for cross-service auth** | `dashboard.env.example:25-26` | Optional header `x-cortex-internal-token` allows other services to bypass auth. Default value is `CORTEX_MASTER_KEY`. **Verify the new app honours the same header.** |
| R-16 | **`dashboard_command_audit` table is referenced but not migrated** | `lib/db/dashboard-command-audit.ts:41`, no migration file | Code inserts into this table; the migration does not create it. **F-2.** |
| R-17 | **In-memory rate limits** | `api/ai/chat/route.ts:50-81`, `lib/ai/tools.ts:55-100` | Module-scope maps; per-process. Multi-worker deploys would bypass the limits. The SvelteKit app inherits the same limitation. Documented as v1.1 follow-up. |
| R-18 | **In-memory confirmation-token consumed store** | `lib/ai/confirmation-token.ts:99-132` | Same single-process limitation. Token replay is possible across worker restarts (TTL clock resets). |

---

## 10. Proposed integration points (SvelteKit dashboard)

The new SvelteKit app should live at `packages/cortex-dashboard/` (matching
the brief's path). It will need to wire to the existing backend surface as
follows. Each row: what the SvelteKit app does, what it depends on,
classification (REUSE / REPLACE / RISKY).

| # | Integration point | Action | Classification |
|---|-------------------|--------|----------------|
| I-1 | **Auth middleware** | Re-implement the cookie + `requireAuth` + `requireAdmin` pattern in SvelteKit hooks. Call `lib/auth.ts`-style helpers. The cleanest approach: copy the **three** functions from `lib/auth.ts:44-92,179-211` and the native `authenticatePam` shim from `lib/pam.ts:1-33` into a shared package. | REUSE (re-implement) + RISKY (R-1, R-6) |
| I-2 | **Database access** | Use a shared package `@cortexos/db-client` that re-exports the `lib/db/*` modules. Or just import them as TS source. The DB connection string is the same `DB_*` env vars. | REUSE (R-4, R-10) |
| I-3 | **Migrations** | Vendor a copy of `scripts/migrate.js` and the `migrations/*.sql` files into the SvelteKit package. **Do not share `migrations/` across the two packages** — both will need to run their own. Risk: divergence. | REPLACE |
| I-4 | **`agent_gateway_audit` writes** | Use the same `lib/db/dashboard-audit.ts`. The DB role grants must be re-issued at deploy time for any new role. | REUSE (R-4) |
| I-5 | **Confirmation tokens** | Copy `lib/ai/confirmation-token.ts` and `lib/ai/session-binding.ts` into a shared package, or into the new dashboard. Wire the same `CORTEX_CONFIRMATION_HMAC_SECRET` env var. | REUSE (R-5, R-8) |
| I-6 | **9Router provider** | Reuse `lib/ai/provider-resolver.ts` (124 lines) verbatim. | REUSE |
| I-7 | **Tool registry** | Reuse `lib/ai/tools.ts` — call from SvelteKit server endpoints instead of Vercel AI SDK tool loop. The SvelteKit chat UI will be its own thing. | REUSE |
| I-8 | **Env-file read/write** | Reuse `lib/secrets/{allowlist,vps-reader,vps-writer}.ts` — ~620 lines of security-sensitive code. Port to a shared package. | REUSE (R-3) |
| I-9 | **Host actions (systemd, docker)** | Reuse `lib/runtime/host-ops.ts:1-113` — name allowlist + audit + log. | REUSE (R-11) |
| I-10 | **Root helper** | Reuse `lib/root-helper/{client,executor}.ts` — UNIX-socket client. | REUSE |
| I-11 | **Real-time push** | Replace Socket.IO with SSE. The SvelteKit server endpoint can poll the same upstream APIs and stream. Risk: backward compat with already-connected clients (none in this case, since the new app replaces the old). | REPLACE (F-4) |
| I-12 | **API surface (`/api/*`)** | Either: (a) keep the same paths and have the SvelteKit app own them; (b) re-mount the existing API handlers as SvelteKit `+server.ts` files. Option (b) means copy-pasting 49 route files. Option (a) is cleaner if the new app is the only thing talking to the API. | REPLACE |
| I-13 | **Stable UI types** | Mirror `lib/sys-pilot/types.ts` exactly. The SvelteKit app's `lib/types.ts` is the source of truth for the UI shape. | REUSE |
| I-14 | **Hermes agent scanner** | Reuse `lib/agents/scanner.ts` — host-filesystem read-only. | REUSE |
| I-15 | **Theme presets + i18n locales** | Reuse `lib/theme-presets.ts` and `messages/*.json`. | REUSE |
| I-16 | **`@cortexos/audit`** | Reuse via `pnpm` workspace dep. New SvelteKit app depends on the same internal package. | REUSE |
| I-17 | **CSP / security headers** | Re-apply at the Caddy layer OR set them in `hooks.server.ts` (SvelteKit). The exact CSP at `next.config.ts:17` should be preserved. | REPLACE (R-7) |
| I-18 | **PAM and Incus provisioning scripts** | The new dashboard does not need to bundle the bash scripts; it only shells out via `hostExecFile`. The provisioner (`scripts/ops/cortex-incus-instance-create.sh`, referenced from `lib/incus/instance-config.ts:5`) lives outside the dashboard. | (unchanged) |
| I-19 | **Login UI** | Port the login flow; the form posts to `/api/auth` (or whatever the SvelteKit equivalent is). The current login page is 27 lines (`app/[locale]/login/page.tsx:1-27`). | REPLACE |
| I-20 | **Account Settings / Password change UI** | The current page (`app/[locale]/admin/account/page.tsx:1-127`) has a "Change password" card that always fails (PAM owns passwords). Either remove that card from the SvelteKit app or keep the same 409 + "manage on the host" message. | REPLACE (R-2) |

---

## 11. Monorepo integration plan

### 11.1 Workspace entry

The new SvelteKit dashboard must live at `packages/cortex-dashboard/`. The
existing `pnpm-workspace.yaml:1-2` already matches `packages/*` so no
registration is required. The new package name should be `@cortexos/dashboard-svelte`
to disambiguate from the existing `@cortexos/dashboard` (Next.js) — at least
for the migration period. Once the Next.js package is removed, rename to
`@cortexos/dashboard`.

`packages/cortex-dashboard/package.json` skeleton:

```json
{
  "name": "@cortexos/dashboard-svelte",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "typecheck": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "dependencies": {
    "@sveltejs/kit": "^2",
    "@sveltejs/adapter-node": "^5",
    "@cortexos/audit": "workspace:*",
    "pg": "^8.20.0",
    "zod": "^4.4.3"
  }
}
```

### 11.2 Shared code packages (proposed)

To avoid copy-paste of security-sensitive code, propose three new internal
packages:

| Package name | Path | Contents | Why |
|--------------|------|----------|-----|
| `@cortexos/auth` | `packages/cortex-auth/` | `lib/auth.ts` + `lib/pam.ts` re-exports | One source of truth for the PAM session. |
| `@cortexos/db` | `packages/cortex-db/` | `lib/db/*.ts` re-exports | All DB CRUD; the new app imports, doesn't fork. |
| `@cortexos/contracts` | `packages/cortex-contracts/` | `lib/sys-pilot/types.ts` + `lib/ai/confirmation-token.ts` + `lib/ai/session-binding.ts` + `lib/ai/provider-resolver.ts` + zod schemas | UI-contract types and HMAC primitives, no Node-only deps in `contracts`. |
| `@cortexos/secrets` | `packages/cortex-secrets/` | `lib/secrets/allowlist.ts` + `vps-reader.ts` + `vps-writer.ts` | Security-sensitive, isolated review. |
| `@cortexos/host-ops` | `packages/cortex-host-ops/` | `lib/runtime/host-ops.ts` + `lib/host-exec.ts` + `lib/root-helper/*` | Privileged command dispatch layer. |

The existing `packages/cortex-audit/` already serves the audit-lib role.

These extractions are non-trivial refactors and SHOULD be a separate workstream
(M0-D or later). For M0, the audit recommends **not** doing them; instead,
port directly with selective copy-paste + clear ownership markers. Refactor
later.

### 11.3 Database & schema

- Both dashboards will coexist briefly. **They must share the same `services`
  schema** (both write to the same tables). Risk: divergence.
- Recommended: **deprecate the Next.js dashboard first** in production
  (grey-out / 410) before turning on the SvelteKit one. Both will run
  during the migration window — make sure the migrations are compatible
  (they share the same DB).
- The missing `dashboard_command_audit` migration must be authored and
  applied before either dashboard can run root-helper commands. See F-2.

### 11.4 CI / CD changes

- `ci.yml` `dashboard` job needs to be **parameterized** or duplicated so
  both `packages/dashboard` and `packages/cortex-dashboard` are built and
  tested.
- The `compose` job's comment (`ci.yml:55-56`) must be updated to match
  the actual deploy path.
- A new `dashboard-svelte` image build/publish step is needed if the
  SvelteKit app is deployed as a container.

### 11.5 Deploy changes

- The Compose stack at `stacks/cortex-dashboard/` needs to point at the
  SvelteKit app. Easiest: rename to `stacks/cortex-dashboard-svelte/` and
  add a second compose file, then `provision-vps.sh` chooses one.
- Caddyfile routes are service-aware (per `prompts/tools/13-caddy.md`).
  New SvelteKit app uses the same path-based routing pattern.

---

## 12. Scope changers (the 5 most important findings)

These are the findings that change scope, sequencing, or risk profile.
Read this section first.

### F-1. **Stale `dashboard_layouts` table; UI uses localStorage.**

`migrations/001_schema.sql:198-204` defines a `dashboard_layouts` table
with `(user_id, layout jsonb)`. The current Overview page stores its
layout in `localStorage` (`app/[locale]/overview/page.tsx:18,22-36,42`)
and **never** hits the API to persist it. The only place a layout API
exists is `api/layout/route.ts`. The SvelteKit app should:
- either consume `dashboard_layouts` server-side (preferred — survives
  device change), or
- remove the unused table.

Pick one early. Default to: **use the table** in the SvelteKit app, drop
the localStorage path.

### F-2. **`dashboard_command_audit` table is referenced by code but no migration creates it.**

`lib/db/dashboard-command-audit.ts:41-83` runs
`INSERT INTO dashboard_command_audit ...` but the four migration files
(`migrations/001_schema.sql`, `002_seed.sql`, `003_incus_instances.sql`,
`004_reconcile_health.sql`) do not define this table. The root-helper
command flow (`api/root-helper/commands/route.ts:37-52` →
`executeRootCommand()` → `createDashboardCommandAudit`) will fail with
`relation "dashboard_command_audit" does not exist` on the first call.

**The Next.js dashboard is shipping with broken code on a fresh DB.**
Either:
1. Add a new migration `005_dashboard_command_audit.sql` to fix the
   tracked code, **or**
2. Document this as a known-broken path (it's only triggered by manual
   root-helper commands) and have the SvelteKit app ship the migration
   with it.

The SvelteKit package should ship its own migration that creates this
table. Track this as M0 follow-up.

### F-3. **The brief assumes systemd deployment; the actual deployment is Docker Compose.**

- The brief expects: `templates/systemd/cortex-dashboard.service`,
  `scripts/ops/cortex-dashboard-build.sh`, `scripts/ops/cortex-render-units.sh`.
- None of these exist on tracked `main`. They only exist in the untracked
  legacy `packages/cortex-dashboard/` directory in the main work tree.
- The actual deploy path: `scripts/provision-vps.sh:203-210` →
  `stacks/cortex-dashboard/docker-compose.yml` →
  `packages/dashboard/Dockerfile` → `docker-entrypoint.sh` → `node server.js`.
- `stacks/` and `templates/` directories **exist on `main` but are missing
  from this worktree**. The worktree was checked out before they were
  added to `.gitignore`-tracked paths, OR `.worktrees/` is ignored.
  Re-verify from a clean checkout.
- `.github/workflows/ci.yml:55-56` and
  `packages/dashboard/docker-compose.yml:1-3` still have stale "systemd"
  comments.

**Scope impact:** the SvelteKit deploy plan must target Docker Compose,
not systemd. If the brief is binding, we need to decide: (a) revert to
systemd for both dashboards; (b) accept Docker Compose and update the
docs. Recommended: accept (b), fix the stale comments.

### F-4. **The real-time surface (Socket.IO + retention loop + alert engine) does not map cleanly to SvelteKit.**

The existing `lib/socket-server.ts:1-208` is 208 lines of mixed concerns:
Socket.IO setup, retention sweep, 5 polling loops, alert engine. SvelteKit
does not ship with Socket.IO; the equivalent is SSE via a `+server.ts`
endpoint, or a separate Node WebSocket process.

Sub-tasks for M0-B (the SvelteKit port):
- Decide: SSE vs. external WS process.
- Port the **alert engine** to a pure function that takes a service
  status snapshot and returns fired events.
- Port the **retention loop** to a SvelteKit `schedule` hook (or a
  separate `cron` job in `scripts/`).
- Port the **polling loops** to either an SSE endpoint that polls
  upstream, or a small standalone process.

**Scope impact:** underestimating this is the #1 way the SvelteKit port
goes off the rails. Budget at least 3 person-days for this.

### F-5. **Two packages called "cortex-dashboard" coexist (one untracked, one tracked).**

The main work tree at `/Users/heitor/Developer/github.com/bloodf/cortexos/`
has `git status` showing `packages/cortex-dashboard/` as an untracked
directory (per the AGENTS.md memory context observation). The new work
plan calls for the SvelteKit app to also live at `packages/cortex-dashboard/`.
**This will collide with the untracked legacy directory** and confuse
every downstream tool (CI, IDE, search).

**Action:** before starting M0-B:
1. Confirm with the user: delete the untracked `packages/cortex-dashboard/`
   (or commit it on a branch, or move it to `archive/`).
2. Then the SvelteKit app can land at the planned path.

### F-6 (bonus). **The brief asks for a SvelteKit dashboard using `https://github.com/bloodf/sys-pilot` as the UI reference.**

`packages/dashboard/` has **already** been ported from sys-pilot (per
commit chain `5766abb` → `6f31f95` → `7ea3ef9` → `68ba13b`, "restore real
data wiring lost in the sys-pilot merge"). The bulk of `src/components/sys-pilot/**`
**is** the sys-pilot design. The "sys-pilot" directory naming reflects
this lineage. So the question for the new SvelteKit app is not "use
sys-pilot as reference" but "port the already-ported sys-pilot UI to
Svelte".

This is a significant reduction in scope. The visual design, layout,
component structure, and per-page behavior are all already decided and
documented at `packages/dashboard/docs/LOVABLE-PROMPT.md` (the source
spec, 364 lines) and at `packages/dashboard/src/lib/sys-pilot/types.ts`
(the stable contract). The SvelteKit port is primarily a
React-to-Svelte translation of those files, not a re-design.

### F-7 (bonus). **`CORTEX_MASTER_KEY` is declared but unused.**

`dashboard.env.example:22` says "32+ byte master key used for credential
encryption". No code in the repo references `CORTEX_MASTER_KEY` directly
(verified with `grep -rn "CORTEX_MASTER_KEY" packages/dashboard/src`
returning no matches). It is also the default value of
`CORTEX_INTERNAL_TOKEN` (`dashboard.env.example:25-26`).

The SvelteKit app should **not** start using it in plaintext. Either
keep it as reserved for future use, or document the planned usage in
`docs/SECRETS.md` (which doesn't exist yet — create it as part of M0).

---

## 13. Open questions for the parent session

1. **Confirm the deploy target.** Docker Compose (current `main`) or systemd
   (legacy docs + brief)? This determines whether the SvelteKit app needs
   its own Dockerfile / compose file, or a `cortex-dashboard-build.sh`.
2. **Confirm the workspace package name.** `@cortexos/dashboard-svelte` for
   the migration window, or commit the new app at `packages/dashboard/`
   and delete the old one in a single atomic PR?
3. **Confirm the untracked `packages/cortex-dashboard/` legacy directory
   disposition.** Delete, branch, or archive?
4. **Is the missing `dashboard_command_audit` migration an M0 must-fix, or
   a known-broken path that can wait?** (Recommend: M0 must-fix; the
   SvelteKit app should ship a working root-helper flow from day 1.)
5. **Real-time: SSE vs. external WS process?** (Recommend: SSE for v1.0
   to keep the stack simple; revisit if a third consumer appears.)
6. **`dashboard_layouts` table: use it or drop it?** (Recommend: use it
   in the new app, drop it from the old.)

---

## 14. Completion summary

- Worktree: `/Users/heitor/Developer/github.com/bloodf/cortexos/.worktrees/m0-a-cortexos-audit`
- Branch: `feature/m0-a-cortexos-audit`
- Files written: 1 (`packages/cortex-dashboard/docs/CURRENT_ARCHITECTURE_AUDIT.md`)
- Files read: 50+ (all of `packages/dashboard/{src,scripts,migrations,docs}/` and
  root `CLAUDE.md`, `ARCHITECTURE.md`, `pnpm-workspace.yaml`, `package.json`,
  `docker-compose.yml`, `.github/workflows/ci.yml`, `renovate.json`).
- Code modified: 0 (read-only audit per task brief).
- Tests run: 0 (audit is read-only; tests not in scope).

See `deliverable.md` for the engine-completion record.
