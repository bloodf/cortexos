# CortexOS Dashboard

Dashboard is the Next.js 16 administration UI for CortexOS. It runs on loopback `127.0.0.1:3080` behind Tailscale Serve at `https://${CORTEX_DOMAIN}/`.

## Capabilities

- Service registry, health checks, categories, open links.
- Apps page with admin-only credential display from service `env_source` files.
- Agents, dispatches, audit trails.
- Environment browser with allowlisted file access.
- Admin-only Docker/systemd actions.
- Terminal workflows.

## Deployment

Production runs as native systemd from the standalone Next.js build. The legacy Docker Compose file is reference only.
`scripts/native-build.sh` installs `libpam0g-dev` before `pnpm install` so `authenticate-pam` can build against `security/pam_appl.h`.


```bash
cd /opt/cortexos/packages/cortex-dashboard
bash scripts/native-build.sh
sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-dashboard.service /etc/systemd/system/cortex-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-dashboard
curl -fsS http://127.0.0.1:3080/api/health
```

Runtime env: `/opt/cortexos/.secrets/dashboard.env`.
Migrations: `scripts/migrate.js`; dynamic service activation: `scripts/dynamic-seed.js`.

## Auth

Dashboard auth is Linux PAM-backed:

- Login validates the Linux username/password with PAM.
- First login auto-creates a `pam_users` row for session foreign keys.
- Admin authorization is captured at login from membership in `cortexos-admin` or `sudo`.
- `admin_sessions.is_admin` stores the admin flag for the session.
- No dashboard-local password hashes or user-management UI exist.

Manage users on the host:

```bash
sudo adduser <username>
sudo passwd <username>
sudo usermod -aG cortexos-admin <username>
```

`/api/auth/password` returns host password-change instructions; it does not change passwords.

## API surfaces

| Route group | Purpose |
|---|---|
| `/api/auth` | PAM login, session status, logout |
| `/api/auth/password` | System password-change instructions |
| `/api/env-browser/*` | Allowlisted env reads/writes |
| `/api/admin/*` | Admin-only config/actions |
| `/api/cortex/*` | Agent/tool interactions |
| `/api/health` | Health reporting |

## Security controls

- HTTP-only `session_token` cookie.
- Admin-only privileged endpoints via stored session admin flag.
- Confirmation tokens for sensitive tools.
- Path allowlist for env browsing.
- Audit logging for reveal, write, dispatch, and admin denial events.

## Credential display

The Apps page reads credentials from service `env_source` `.env` files under `/opt/cortexos/.secrets` or stack dirs. `APP_CREDENTIALS_JSON` overrides file discovery.
