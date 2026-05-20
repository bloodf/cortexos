# pgAdmin 4

## Purpose

Run pgAdmin for PostgreSQL administration.

## Install mode

Docker. DB admin UIs are containerized. Persistent data MUST use named volumes.

## Prerequisites

- `14-postgresql.md` completed.
- `INSTALL_PGADMIN=yes`.

## Todo

- [ ] CHECKPOINT 1 confirmed — Postgres reachable + port 5050 free
- [ ] Copy `stacks/pgadmin/docker-compose.yml`
- [ ] Write `/opt/cortexos/.secrets/pgadmin.env` mode 0600
- [ ] `docker compose up -d`
- [ ] Confirm `/misc/ping` returns 200

## Install

`/opt/cortexos/.secrets/pgadmin.env`:

```bash
PGADMIN_DEFAULT_EMAIL=admin@cortexos.tailfd052e.ts.net
PGADMIN_DEFAULT_PASSWORD=<random>
```

Start from `/opt/cortexos/stacks/pgadmin`.

## CHECKPOINT 2

Confirm `curl -fsS http://127.0.0.1:5050/misc/ping` returns 200.
