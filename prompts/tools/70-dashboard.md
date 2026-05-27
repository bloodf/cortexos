# Dashboard (native)

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Build and deploy the CortexOS Next.js dashboard as a native systemd service using the Next.js standalone output. Docker is not used for the dashboard in the native-first install.

## Prerequisites

- `14-postgresql.md` completed.
- `13-tailscale-serve.md` completed (Tailscale Serve publishes the dashboard root to port 3080).
- `40-hermes.md`, `41-hermes-profiles.md`, and `42-hermes-honcho.md` completed.
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
- [ ] Run dashboard migrations and dynamic service seed before starting service
- [ ] Configure terminal SSH and Hermes scan env in `/opt/cortexos/.secrets/dashboard.env`
- [ ] `systemctl enable --now cortex-dashboard`
- [ ] `/en/login` returns 200 locally
- [ ] Public URL serves login page through Tailscale Serve
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `test -f /opt/cortexos/.secrets/dashboard.env && pg_isready -h 127.0.0.1 -p 5432` show the env file and Postgres accepting connections?

Type `confirmed` to proceed.

## Build, configure & install

```bash
sudo install -d -m 0755 /opt/cortexos/packages
sudo cp -a packages/cortex-dashboard /opt/cortexos/packages/
sudo cp -a packages/cortex-audit /opt/cortexos/packages/

# Ensure dashboard.env contains runtime defaults that should not require manual
# reconfiguration on a new machine. Root SSH is disabled by OS hardening, so the
# web terminal uses the operator account over localhost SSH.
sudo install -d -m 0700 /opt/cortexos/.secrets
sudo touch /opt/cortexos/.secrets/dashboard.env
sudo chmod 0600 /opt/cortexos/.secrets/dashboard.env
sudo /opt/cortexos/templates/scripts/cortex-env-writer.sh <<'JSON'
{"path":"/opt/cortexos/.secrets/dashboard.env","updates":[
  {"key":"HERMES_PROFILES_REGISTRY","value":"/opt/cortexos/hermes/profiles.json"},
  {"key":"AGENT_SCAN_PATHS","value":"/opt/cortexos/hermes/profiles"},
  {"key":"HERMES_PRIMARY_URL","value":"http://127.0.0.1:18691"},
  {"key":"HERMES_SECONDARY_URL","value":"http://127.0.0.1:18692"},
  {"key":"HONCHO_BASE_URL","value":"http://127.0.0.1:18690"},
  {"key":"TERMINAL_SSH_HOST","value":"127.0.0.1"},
  {"key":"TERMINAL_SSH_PORT","value":"22"},
  {"key":"TERMINAL_SSH_USER","value":"cortexos"},
  {"key":"TERMINAL_SSH_KEY","value":"/home/cortexos/.ssh/id_ed25519"},
  {"key":"SSH_USER","value":"cortexos"}
]}
JSON

cd /opt/cortexos/packages/cortex-dashboard
bash scripts/native-build.sh
set -a; . /opt/cortexos/.secrets/dashboard.env; set +a
DB_HOST="${DB_HOST:-127.0.0.1}" node scripts/migrate.js
DB_HOST="${DB_HOST:-127.0.0.1}" node scripts/dynamic-seed.js || true
sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-dashboard.service /etc/systemd/system/cortex-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-dashboard
```

The service starts `node .next/standalone/server.js` on loopback port `3080`, loads `/opt/cortexos/.secrets/dashboard.env`, and runs against host PostgreSQL. The dashboard auth middleware can gate `/api/health`; use `/en/login` for unauthenticated liveness. Migrations include only CortexOS dashboard runtime seeds. Agent Factory creation is not exposed in the dashboard; Cortex Hermes owns factory creation through its dedicated skill.

## Verify

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080/en/login
curl -fsS -o /dev/null -w "%{http_code}\n" "https://${CORTEX_DOMAIN}/en/login"
```

Expected: both login probes return `200`.

## CHECKPOINT 2

**STOP — operator question:** Do the local and Tailscale `/en/login` probes print `200`?

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
