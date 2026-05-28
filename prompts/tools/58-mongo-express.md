# 58 - mongo-express

## Purpose

Run mongo-express for MongoDB administration. Live container: `cortex-mongo-express`, host port 8083 → container port 8081, served by Caddy at `/mongo-admin`.

> **Note:** The Caddy route is `/mongo-admin`, NOT `/mongo-express`.

## Install mode

Docker. DB admin UIs are containerized.

## Prerequisites

- `16-mongodb.md` completed — MongoDB healthy.
- `13-caddy.md` completed — Caddy configured to reverse-proxy `/mongo-admin → 127.0.0.1:8083`.

## Todo

- [ ] CHECKPOINT 1 confirmed — MongoDB enabled, port 8083 free
- [ ] Write `/opt/cortexos/.secrets/mongodb.env` with Mongo root + mongo-express basic-auth vars, mode 0600
- [ ] Copy `stacks/mongodb/docker-compose.yml` (includes `mongo-express` service)
- [ ] `docker compose up -d --remove-orphans`
- [ ] CHECKPOINT 2 confirmed — `401` without auth, `200` with auth

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 8083` print no output (port 8083 free)?

```bash
ss -tlnp | grep 8083
docker ps --filter name=mongodb --format '{{.Names}} {{.Status}}'
```

Type `confirmed` to proceed.

## Configure secrets

**STOP — operator action required:** Provide or confirm the following values. Generate random passwords with `openssl rand -hex 20`.

- `MONGO_INITDB_ROOT_USERNAME` — MongoDB root user (default: `admin`)
- `MONGO_INITDB_ROOT_PASSWORD` — MongoDB root password
- `ME_CONFIG_BASICAUTH_USERNAME` — basic-auth username for mongo-express UI
- `ME_CONFIG_BASICAUTH_PASSWORD` — basic-auth password for mongo-express UI

> If MongoDB was already initialized with different credentials, use those existing root credentials here. Do NOT change the root password unless you also update the Mongo user.

Write the secret file (append to existing `mongodb.env` if it exists):

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets
sudo tee /opt/cortexos/.secrets/mongodb.env >/dev/null <<EOF
MONGO_INITDB_ROOT_USERNAME={MONGO_INITDB_ROOT_USERNAME}
MONGO_INITDB_ROOT_PASSWORD={MONGO_INITDB_ROOT_PASSWORD}
ME_CONFIG_MONGODB_ADMINUSERNAME={MONGO_INITDB_ROOT_USERNAME}
ME_CONFIG_MONGODB_ADMINPASSWORD={MONGO_INITDB_ROOT_PASSWORD}
ME_CONFIG_BASICAUTH_USERNAME={ME_CONFIG_BASICAUTH_USERNAME}
ME_CONFIG_BASICAUTH_PASSWORD={ME_CONFIG_BASICAUTH_PASSWORD}
ME_CONFIG_MONGODB_URL=mongodb://{MONGO_INITDB_ROOT_USERNAME}:{MONGO_INITDB_ROOT_PASSWORD}@mongodb:27017/
EOF
sudo chmod 600 /opt/cortexos/.secrets/mongodb.env
```

Confirm mode 600:

```bash
stat -c "%a" /opt/cortexos/.secrets/mongodb.env
```

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/mongodb
sudo cp -a stacks/mongodb/. /opt/cortexos/stacks/mongodb/
cd /opt/cortexos/stacks/mongodb
docker compose --env-file /opt/cortexos/.secrets/mongodb.env up -d --remove-orphans
```

Verify compose config resolves the env file correctly:

```bash
docker compose --env-file /opt/cortexos/.secrets/mongodb.env config --no-interpolate | grep -E 'ME_CONFIG|MONGO'
```

## Verify

```bash
source /opt/cortexos/.secrets/mongodb.env
# Unauthenticated: expect 401
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8083/

# Authenticated: expect 200
curl -fsS -u "${ME_CONFIG_BASICAUTH_USERNAME}:${ME_CONFIG_BASICAUTH_PASSWORD}" \
  http://127.0.0.1:8083/ >/dev/null && echo OK
```

## CHECKPOINT 2

**STOP — operator question:** Does `curl http://127.0.0.1:8083/` return `401`, and does it return `200` with the correct basic-auth credentials? Does the Caddy `/mongo-admin` route load the UI from the tailnet?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/mongodb
docker compose stop mongo-express
docker compose rm -f mongo-express
```

MongoDB data volumes are not affected.

## Next

→ `prompts/tools/59-phpmyadmin.md`
