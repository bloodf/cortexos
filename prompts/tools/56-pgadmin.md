# 56 - pgAdmin 4

## Purpose

Run pgAdmin 4 for PostgreSQL administration. Live container: `cortex-pgadmin`, served by Caddy at `/pgadmin`.

## Install mode

Docker. Persistent data uses named volumes.

## Prerequisites

- `14-postgresql.md` completed — PostgreSQL reachable on `127.0.0.1:5432`.
- `13-caddy.md` completed — Caddy configured to reverse-proxy `/pgadmin`.

## Todo

- [ ] CHECKPOINT 1 confirmed — PostgreSQL healthy, port 5050 free
- [ ] Write `/opt/cortexos/.secrets/pgadmin.env` mode 0600
- [ ] Copy `stacks/pgadmin/docker-compose.yml` to `/opt/cortexos/stacks/pgadmin/`
- [ ] `docker compose up -d --remove-orphans`
- [ ] CHECKPOINT 2 confirmed — pgAdmin reachable at `/misc/ping`

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 5050` print no output (port 5050 free)?

```bash
ss -tlnp | grep 5050
psql -U dashboard -h 127.0.0.1 cortex_dashboard -c '\conninfo'
```

Type `confirmed` to proceed.

## Configure secrets

**STOP — operator action required:** Provide the following values.

- `PGADMIN_DEFAULT_EMAIL` — admin login email (default: `admin@cortexos.local`)
- `PGADMIN_DEFAULT_PASSWORD` — admin password; generate with `openssl rand -hex 16`

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets
sudo tee /opt/cortexos/.secrets/pgadmin.env >/dev/null <<EOF
PGADMIN_DEFAULT_EMAIL={PGADMIN_DEFAULT_EMAIL}
PGADMIN_DEFAULT_PASSWORD={PGADMIN_DEFAULT_PASSWORD}
EOF
sudo chmod 600 /opt/cortexos/.secrets/pgadmin.env
```

Confirm mode 600:

```bash
stat -c "%a" /opt/cortexos/.secrets/pgadmin.env
```

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/pgadmin
sudo cp -a stacks/pgadmin/. /opt/cortexos/stacks/pgadmin/
cd /opt/cortexos/stacks/pgadmin
docker compose --env-file /opt/cortexos/.secrets/pgadmin.env up -d --remove-orphans
```

## Verify

```bash
curl -fsS http://127.0.0.1:5050/misc/ping
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5050/login
```

Expected: `/misc/ping` returns 200; `/login` returns 200 with the login page.

Login with `PGADMIN_DEFAULT_EMAIL` + `PGADMIN_DEFAULT_PASSWORD`.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:5050/misc/ping` return HTTP 200, and does the Caddy `/pgadmin` route load the pgAdmin login page from the tailnet?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/pgadmin
docker compose down
```

## Next

→ `prompts/tools/58-mongo-express.md`
