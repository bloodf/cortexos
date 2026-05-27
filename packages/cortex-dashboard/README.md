# Cortex Dashboard

Next.js 16 admin/observability UI for CortexOS VPS.

## Quick start

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

Production build:

```bash
pnpm run build
pnpm start
```

## Architecture

- Next.js App Router, React 19, TypeScript.
- PostgreSQL via `pg`.
- App routes: `src/app/[locale]`.
- API routes: `src/app/api`.
- Native production runtime: systemd service on `127.0.0.1:3080`.
- Tailscale Serve publishes `https://${CORTEX_DOMAIN}/`.

## Authentication

Authentication is Linux PAM-backed.

- `POST /api/auth` validates Linux username/password via `authenticate-pam`.
- `pam_users` maps Linux usernames to stable integer IDs for DB foreign keys.
- `admin_sessions` stores session token, expiry, and `is_admin` captured at login.
- Admin users are Linux users in `cortexos-admin` or `sudo`.
- There is no dashboard-local password table, setup wizard, or user CRUD UI.

Manage users on the host:

```bash
sudo adduser <username>
sudo passwd <username>
sudo usermod -aG cortexos-admin <username>
```

`/api/auth/password` returns system password-change instructions; it does not mutate credentials.

## API route map

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/auth` | GET/POST/DELETE | mixed | Session status, PAM login, logout |
| `/api/auth/password` | GET/POST | yes for POST | Host password-change instructions |
| `/api/system` | GET | no | CPU, memory, disk, uptime, load |
| `/api/processes` | GET | no | Top processes |
| `/api/network` | GET | no | Network counters |
| `/api/services` | GET | no | Service health and registry data |
| `/api/docker` | GET | no | Containers/images/volumes |
| `/api/docker/actions` | POST | yes | Docker action |
| `/api/systemd` | GET | yes | systemd units |
| `/api/systemd/actions` | POST | yes | systemd action |
| `/api/agents` | GET | no | Hermes profile groups |
| `/api/admin/*` | varies | admin | Admin configuration |
| `/api/env-browser/*` | varies | admin | Allowlisted env file access |

## Database

Core tables:

- `migrations`
- `services`
- `badges`, `service_badges`
- `credentials`
- `pam_users`
- `admin_sessions`
- `service_health_log`
- `alert_rules`, `alert_history`
- `action_log`
- `config`
- `dashboard_layouts`

Migrations live in `migrations/*.sql`; runner: `scripts/migrate.js`.

## Apps credentials

The Apps page reads credential keys from the service row's `env_source` file. `APP_CREDENTIALS_JSON` overrides file lookup.

## Deployment

Production deploy on VPS:
`scripts/native-build.sh` installs `libpam0g-dev` before `pnpm install` so `authenticate-pam` can build its PAM native addon.


```bash
cd /opt/cortexos/packages/cortex-dashboard
bash scripts/native-build.sh
sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-dashboard.service /etc/systemd/system/cortex-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-dashboard
curl -fsS http://127.0.0.1:3080/api/health
```

Required env in `/opt/cortexos/.secrets/dashboard.env`:

- `DB_PASSWORD` or `DASHBOARD_DB_PASSWORD`
- `CORTEX_MASTER_KEY`

## Testing

```bash
pnpm test
pnpm run lint
pnpm run build
```
