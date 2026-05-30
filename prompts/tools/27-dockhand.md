# 27 - Dockhand

> **OPTIONAL** — Install only if a Docker Compose stack management UI is needed.

## Purpose

Run Dockge as Dockhand — a web UI for managing Docker Compose stacks. Live container: `cortex-dockhand` on port 3420.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 3420 free
- [ ] Copy `stacks/dockhand/docker-compose.yml`
- [ ] `docker compose up -d --remove-orphans`
- [ ] CHECKPOINT 2 confirmed — Dockhand UI loads

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 3420` print no output (port 3420 free)?

```bash
ss -tlnp | grep 3420
```

Type `confirmed` to proceed.

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/dockhand
sudo cp -a stacks/dockhand/. /opt/cortexos/stacks/dockhand/
cd /opt/cortexos/stacks/dockhand
docker compose up -d --remove-orphans
```

## Verify

```bash
curl -fsS http://127.0.0.1:3420 >/dev/null && echo OK
```

Expected: Dockge/Dockhand UI responds with HTTP 200.

Dockge has no env-var auth bootstrap. The first user is created through the setup UI on first load. If a user already exists, use the existing account — or reset/update the SQLite `user` row using Dockge's password hash helper.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:3420/` load the Dockhand UI from a tailnet device, and is a user account configured?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/dockhand
docker compose down
```

## Next

→ `prompts/tools/28-db-exporters.md`
