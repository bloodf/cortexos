# Dashboard (native)

## Purpose

Build and deploy the CortexOS Next.js dashboard as a native systemd service using the Next.js standalone output. Docker is not used for the dashboard in the native-first install.

## Prerequisites

- `14-postgresql.md` completed.
- `13-caddy.md` completed (Caddy proxies root and `/api/*` to port 3080).
- `40-openclaw.md` completed.
- Repo materialized at `/opt/cortexos`.

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — secrets and DB reachable
- [ ] Copy dashboard package to `/opt/cortexos/packages/cortex-dashboard`
- [ ] Run `packages/cortex-dashboard/scripts/native-build.sh`
- [ ] Install `templates/systemd/cortex-dashboard.service`
- [ ] `systemctl enable --now cortex-dashboard`
- [ ] `/api/health` and `/en/login` return 200 locally
- [ ] Public URL serves login page through Caddy
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `test -f /opt/cortexos/.secrets/dashboard.env && pg_isready -h 127.0.0.1 -p 5432` show the env file and Postgres accepting connections?

Type `confirmed` to proceed.

## Build & install

```bash
sudo install -d -m 0755 /opt/cortexos/packages
sudo cp -a packages/cortex-dashboard /opt/cortexos/packages/
sudo cp -a packages/cortex-events packages/cortex-audit /opt/cortexos/packages/
cd /opt/cortexos/packages/cortex-dashboard
bash scripts/native-build.sh
sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-dashboard.service /etc/systemd/system/cortex-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-dashboard
```

The service starts `node .next/standalone/server.js` on port `3080`, loads `/opt/cortexos/.secrets/dashboard.env`, runs against host PostgreSQL, and exposes `/api/health` unauthenticated for service checks.

## Verify

```bash
curl -fsS http://127.0.0.1:3080/api/health
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080/en/login
curl -fsS -o /dev/null -w "%{http_code}\n" "https://${CORTEX_DOMAIN}/en/login"
```

Expected: `/api/health` returns `{"status":"ok","service":"cortex-dashboard",...}` and both login probes return `200`.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:3080/api/health` return JSON status ok and does `curl -sS -o /dev/null -w "%{http_code}" https://${CORTEX_DOMAIN}/en/login` print `200`?

Type `confirmed` to proceed.

## Operations

| Action | Command |
|---|---|
| Restart | `sudo systemctl restart cortex-dashboard` |
| Stop | `sudo systemctl stop cortex-dashboard` |
| Update env | edit `/opt/cortexos/.secrets/dashboard.env` → `sudo systemctl restart cortex-dashboard` |
| Logs | `journalctl -u cortex-dashboard -f` |

## Next

→ `prompts/tools/80-agent-factory.md`
