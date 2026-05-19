# MySQL 8 — CONDITIONAL

## Purpose

Run MySQL 8 as a Docker container for optional relational workloads.

## Install mode

Docker. Database engines are containerized in CortexOS. Persistent data MUST use named volumes.

## Prerequisites

- `11-docker.md` completed.
- SETUP.md questionnaire: `INSTALL_MYSQL=yes`.

## Todo

- [ ] CHECKPOINT 1 confirmed — MySQL needed + port 3306 free
- [ ] Write `/opt/cortexos/stacks/mysql/docker-compose.yml`
- [ ] Write `/opt/cortexos/.secrets/mysql.env` mode 0600
- [ ] `docker compose --env-file /opt/cortexos/.secrets/mysql.env up -d`
- [ ] Confirm `mysqladmin ping` succeeds
- [ ] CHECKPOINT 2 confirmed — container healthy

## CHECKPOINT 1

If `INSTALL_MYSQL=no`, skip this spoke. If enabled, confirm port 3306 is free.

## Install

Use repo stack `stacks/mysql/docker-compose.yml`; copy it to `/opt/cortexos/stacks/mysql/`.

Generate `/opt/cortexos/.secrets/mysql.env`:

```bash
MYSQL_ROOT_PASSWORD=<random>
MYSQL_DATABASE=cortexos
MYSQL_USER=cortexos
MYSQL_PASSWORD=<random>
```

Start:

```bash
cd /opt/cortexos/stacks/mysql
docker compose --env-file /opt/cortexos/.secrets/mysql.env up -d
```

## Verify

```bash
docker exec cortex-mysql mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent
```

## CHECKPOINT 2

Confirm `docker compose ps` shows `mysql` healthy.
