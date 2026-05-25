# pgAdmin 4

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

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

`/opt/cortexos/.secrets/pgadmin.env` (and the compose-resolved repo `.secrets/pgadmin.env` if running compose from the checkout):

```bash
PGADMIN_DEFAULT_EMAIL=admin@cortexos.local
PGADMIN_DEFAULT_PASSWORD=<random>
```

Start from `/opt/cortexos/stacks/pgadmin`.

## CHECKPOINT 2

Confirm `curl -fsS http://127.0.0.1:5050/misc/ping` returns 200 and `http://127.0.0.1:5050/login` returns the login page. Login uses `PGADMIN_DEFAULT_EMAIL` + `PGADMIN_DEFAULT_PASSWORD`.
