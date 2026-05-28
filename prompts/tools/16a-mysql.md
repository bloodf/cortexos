# 16a - MySQL 8

## Purpose

Run MySQL 8 as a Docker stack for optional relational workloads. Live container: `cortex-mysql` on port 3306.

## Install mode

Docker. Persistent data uses named volumes.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 3306 free (or existing `cortex-mysql` container is the intended instance)
- [ ] Write `/opt/cortexos/.secrets/mysql.env` mode 0600
- [ ] Copy `stacks/mysql/docker-compose.yml` to `/opt/cortexos/stacks/mysql/`
- [ ] `docker compose up -d --remove-orphans`
- [ ] CHECKPOINT 2 confirmed — container healthy, `mysqladmin ping` succeeds

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 3306` print no output (port 3306 free, no prior MySQL instance)?

If a `cortex-mysql` container already exists from a prior install, confirm it is the intended instance before proceeding.

Type `confirmed` to proceed.

## Configure secrets

**STOP — operator action required:** Provide the following values. Generate random passwords with `openssl rand -hex 20`.

- `MYSQL_ROOT_PASSWORD` — root password for the MySQL instance
- `MYSQL_DATABASE` — database name (default: `cortexos`)
- `MYSQL_USER` — application user (default: `cortexos`)
- `MYSQL_PASSWORD` — application user password

Write the secret file:

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets
sudo tee /opt/cortexos/.secrets/mysql.env >/dev/null <<EOF
MYSQL_ROOT_PASSWORD={MYSQL_ROOT_PASSWORD}
MYSQL_DATABASE=cortexos
MYSQL_USER=cortexos
MYSQL_PASSWORD={MYSQL_PASSWORD}
EOF
sudo chmod 600 /opt/cortexos/.secrets/mysql.env
```

Confirm the file is mode 600:

```bash
stat -c "%a" /opt/cortexos/.secrets/mysql.env
```

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/mysql
sudo cp -a stacks/mysql/. /opt/cortexos/stacks/mysql/
cd /opt/cortexos/stacks/mysql
docker compose --env-file /opt/cortexos/.secrets/mysql.env up -d --remove-orphans
```

## Verify

```bash
source /opt/cortexos/.secrets/mysql.env
docker exec cortex-mysql mysqladmin ping -h 127.0.0.1 -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent
docker compose --env-file /opt/cortexos/.secrets/mysql.env ps
```

Expected: `mysqladmin ping` prints `mysqld is alive`; `docker compose ps` shows `cortex-mysql` healthy.

## CHECKPOINT 2

**STOP — operator question:** Does `docker compose ps` show `cortex-mysql` with status `healthy` (or `running` if no healthcheck is configured)?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/mysql
docker compose down
```

Named volumes are preserved. To also remove data volumes:

```bash
docker compose down -v
```

## Next

→ `prompts/tools/17-dnsmasq.md`
