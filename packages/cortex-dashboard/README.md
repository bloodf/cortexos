# Cortex Dashboard

## Overview

Cortex Dashboard is Next.js 16 admin and observability UI for CortexOS VPS. It shows host metrics, process data, service health, Docker inventory, OpenClaw agents, service registry controls, credentials, badges, environment values, and admin-only Docker/systemd actions.

## Quick Start

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

Production build (runs `next build --turbopack` then esbuilds `server.ts` over the standalone server):

```bash
pnpm run build
pnpm start
```

For a fresh VPS (run on the VPS, dispatched by `scripts/bootstrap.sh`
from the operator laptop, or invoked directly):

```bash
./scripts/provision-vps.sh                 # docker engine, postgres, role+DB, secrets dir, compose up
```

Subsequent rebuilds happen entirely on the VPS via Docker Compose:

```bash
cd /opt/cortexos/stacks/cortex-dashboard
docker compose up -d --build
```

## Architecture

- Framework: Next.js 16 App Router, React 19, TypeScript.
- UI: Tailwind CSS v4, shadcn-style local components, lucide-react, Recharts.
- Runtime: custom `server.ts`, Node APIs, PostgreSQL via `pg`.
- App routes live in `src/app/[locale]` with locale support.
- API routes live in `src/app/api`.
- Server components fetch database state (`admin/page.tsx`, `login/page.tsx`, `setup/page.tsx`).
- Client components handle polling, actions, forms, and tabs (`admin-dashboard.tsx`, Docker tables, auth forms).

### API route map

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/system` | GET | No | CPU, memory, disk, uptime, load. |
| `/api/processes` | GET | No | Top processes. |
| `/api/network` | GET | No | Network interface counters. |
| `/api/services` | GET | No | Service health and registry data. |
| `/api/services/uptime` | GET | No | Uptime/history summary. |
| `/api/docker` | GET | No | Containers, images, volumes. |
| `/api/docker/actions` | POST | Yes | Start/stop/restart Docker container. |
| `/api/systemd` | GET | Yes | List systemd service units. |
| `/api/systemd/actions` | POST | Yes | Start/stop/restart systemd unit. |
| `/api/agents` | GET | No | OpenClaw agent groups. |
| `/api/agents/[slug]/files` | GET | No | Agent markdown file list. |
| `/api/agents/[slug]/files/[filename]` | GET/PATCH | No | Read/write agent markdown file. |
| `/api/auth` | GET/POST/DELETE | Mixed | Session status, login, logout. |
| `/api/auth/password` | PATCH | Yes | Change admin password. |
| `/api/auth/setup` | GET/POST | No until first admin exists | First admin bootstrap. |
| `/api/admin/services` | GET/POST/PATCH/DELETE | Yes | Service registry CRUD/toggles. |
| `/api/badges` | GET/POST/PATCH/DELETE | Yes | Service badge management. |
| `/api/credentials` | GET/POST/PATCH/DELETE | Yes | Encrypted credential management. |
| `/api/env` | GET | Yes | Environment viewer. |
| `/api/alerts` | GET/POST/PATCH/DELETE | Yes | Alert rules/history. |
| `/api/layout` | GET/PATCH | No | Dashboard widget layout. |
| `/api/terminal` | GET | No | Terminal/session endpoint. |

## Database

PostgreSQL schema lives in `migrations/001_schema.sql`; seed data lives in `migrations/002_seed.sql`. Migration runner: `src/lib/db/migrate.ts`.

Core tables:

- `migrations` — applied migration names.
- `services` — registry rows, health settings, category, UI flags.
- `badges` — service labels and colors.
- `credentials` — encrypted service credentials.
- `admin_users` — admin usernames and bcrypt password hashes.
- `admin_sessions` — session tokens and expiration.
- `service_health_log` — health status history.
- `alert_rules`, `alert_history` — alert definitions and events.
- `action_log` — Docker/systemd action audit trail.
- `config` — key/value settings.
- `dashboard_layouts` — user dashboard widget layout JSON.

Seed data creates public-safe service registry entries only. No default `admin:123456` user exists.

## Authentication

Authentication uses bcrypt password hashes and HTTP-only `session_token` cookies. Sessions last 7 days.

First-time setup:

1. Visit `/setup`.
2. Create first admin username/password.
3. Setup endpoint rejects future calls once any admin user exists.
4. Login via `/login`.

Middleware protects `/admin`, `/api/admin/*`, and `/api/credentials/*`. Setup and login are public. API route handlers also call `requireAuth` for sensitive actions.

## Service Registry

`services` table drives dashboard cards, health checks, and admin toggles.

Important columns:

- `slug`, `name`, `category`, `sort_order`
- `url` — web UI link or `#`
- `health_url` — target for health check
- `health_type` — `http`, `tcp`, `docker`, or `process`
- `is_active` — admin visibility/availability switch
- `has_webui`, `show_in_healthcheck`, `show_in_webui`
- icon fields: `icon_type`, `icon_color`, `icon_image`

Health targets:

- `http`: fetch URL and treat 2xx/3xx as online.
- `tcp`: open TCP socket from `tcp://host:port`.
- `docker`: look for container by name.
- `process`: look for host process by name.

## API Reference

### Auth

`POST /api/auth`

Request:

```json
{ "username": "admin", "password": "secret" }
```

Response:

```json
{ "success": true, "username": "admin" }
```

`GET /api/auth` returns `{ "authenticated": true, "username": "admin" }` or 401.

`DELETE /api/auth` clears session.

`POST /api/auth/setup` works only when `admin_users` count is zero.

Request:

```json
{ "username": "admin", "password": "long-secret" }
```

### Admin services

`GET /api/admin/services?all=1` returns active and inactive services.

`POST /api/admin/services` creates service.

`PATCH /api/admin/services` updates fields or toggles active state:

```json
{ "id": 1, "is_active": false }
```

`DELETE /api/admin/services?id=1` deletes service.

### Docker actions

`POST /api/docker/actions`

```json
{ "name": "cortex-dashboard", "action": "restart" }
```

Valid actions: `start`, `stop`, `restart`.

### Systemd actions

`GET /api/systemd` returns parsed `systemctl list-units --type=service --all` rows.

`POST /api/systemd/actions`

```json
{ "name": "docker.service", "action": "restart" }
```

Valid actions: `start`, `stop`, `restart`. Unit names must match safe systemd characters.

### Agents

`GET /api/agents` returns project groups with agent metadata, short model name, workspace, and markdown files.

`GET /api/agents/[slug]/files` returns markdown files for one agent.

`GET /api/agents/[slug]/files/[filename]` reads file content.

`PATCH /api/agents/[slug]/files/[filename]` writes file content.

## Agents

Scanner lives in `src/lib/agents/scanner.ts`.

OpenClaw mode reads `${OPENCLAW_BASE}/openclaw.json` or first `AGENT_SCAN_PATHS` entry. `openclaw.json` agent entries can store model as string or `{ primary }`. Scanner normalizes both and displays last path segment as model label.

Agent role files are loaded from:

```text
${OPENCLAW_BASE}/agents/<agent-id>/agent/*.md
```

Legacy mode walks scan roots looking for `.agents/<agent>/*.md` directories.

Path safety: file reads/writes must stay inside configured scan roots.

## Docker/Systemd

Docker inventory uses `/api/docker` and host Docker socket mounted read-only at `/var/run/docker.sock`. Action endpoint shells through Docker CLI and logs to `action_log`.

Systemd inventory uses `systemctl list-units`. Actions use `systemctl start|stop|restart <unit>` through `hostExecFile`. In container deployment, `hostExecFile` uses `nsenter` to target host namespaces. Docker Compose grants `pid: host` and `privileged: true` for this.

## Admin Panel

Admin page `/admin` tabs:

- Service Toggles — active/inactive switch for registry rows.
- Badge Manager — manage badges per service.
- Credentials Manager — encrypted username/password/notes per service.
- Env Viewer — inspect environment for selected service slug.
- Systemd Services — list and control host units.

Docker page renders container action buttons per row: start, stop, restart.

## Deployment

`docker-compose.yml` runs PostgreSQL 17 Alpine and dashboard on port `3080`. Dashboard container mounts host proc/sys data, Docker socket, hostname, and OpenClaw base.

Production deploy runs **on the VPS** via Docker Compose. The image is
built from `dashboard/Dockerfile` against the materialized repo tree at
`/opt/cortexos` — no laptop-side build, no rsync, no systemd unit. The
operator laptop dispatches via `scripts/bootstrap.sh`.

```bash
# On the VPS
cd /opt/cortexos/stacks/cortex-dashboard
docker compose up -d --build
docker compose logs -f cortex-dashboard
curl -fsS http://127.0.0.1:3080/api/health
```

Required env (loaded from `/opt/cortexos/.secrets/dashboard.env`,
mode `0600`):

- `DASHBOARD_DB_PASSWORD`
- `CORTEX_MASTER_KEY` (≥ 32 bytes)

Tailscale Serve publishes the dashboard root (see `prompts/tools/13-tailscale-serve.md` for the full routing flow):

```bash
sudo tailscale serve --bg --https=443 http://localhost:3080
```

## i18n

Locales: `en`, `es`, `pt-br`. Locale-aware pages live under `src/app/[locale]`. Routing helpers live in `src/i18n`. Middleware understands locale prefixes for protected pages and public setup/login pages.

## Testing

Test runner: Vitest.

```bash
pnpm test
pnpm run test:watch
pnpm run test:coverage
```

Patterns:

- API route tests live next to routes as `route.test.ts`.
- DB tests live under `src/lib/db/__tests__`.
- Component tests live under component `__tests__` directories.
- Agent scanner tests mock `node:fs/promises` and environment paths.

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `3000` dev / `3080` compose | HTTP port. |
| `NODE_ENV` | No | `development` | Runtime mode. |
| `DB_HOST` | No | `127.0.0.1` | PostgreSQL host. |
| `DB_PORT` | No | `5432` | PostgreSQL port. |
| `DB_NAME` | No | `cortex_dashboard` | PostgreSQL database. |
| `DB_USER` | No | `dashboard` | PostgreSQL user. |
| `DB_PASSWORD` | Yes | none | PostgreSQL password used by app. |
| `DASHBOARD_DB_PASSWORD` | Compose | none | PostgreSQL password injected into DB and app. |
| `CORTEX_MASTER_KEY` | Yes for credentials | none | Master key for credential encryption. |
| `DASHBOARD_ORIGIN` | No | `http://localhost:3080` | Public dashboard origin. |
| `OPENCLAW_BASE` | No | `$HOME/.openclaw` or compose path | OpenClaw config/agent base. |
| `AGENT_SCAN_PATHS` | No | `OPENCLAW_BASE` | Comma/colon separated scan roots; first entry used for `openclaw.json`. |
| `SSH_USER` | No | `cortex` in compose | SSH/deploy user hint. |
| `HOME` | No | host runtime value | Fallback for default `.openclaw` path. |
