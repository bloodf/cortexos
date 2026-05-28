# 59 - phpMyAdmin

## Purpose

Run phpMyAdmin for MySQL administration. Live container: `cortex-phpmyadmin`, served by Caddy at `/phpmyadmin`.

## Install mode

Docker. DB admin UIs are containerized.

## Prerequisites

- `16a-mysql.md` completed — `cortex-mysql` healthy.
- `13-caddy.md` completed — Caddy configured to reverse-proxy `/phpmyadmin`.

## Todo

- [ ] CHECKPOINT 1 confirmed — MySQL enabled, `cortex-mysql` running
- [ ] `stacks/mysql/docker-compose.yml` includes `phpmyadmin` service
- [ ] `MYSQL_ROOT_PASSWORD` present in `/opt/cortexos/.secrets/mysql.env`
- [ ] `docker compose up -d --remove-orphans phpmyadmin`
- [ ] CHECKPOINT 2 confirmed — phpMyAdmin loads

## CHECKPOINT 1

**STOP — operator question:** Is `cortex-mysql` running and healthy?

```bash
docker ps --filter name=cortex-mysql --format '{{.Names}} {{.Status}}'
test -f /opt/cortexos/.secrets/mysql.env && echo "secrets present" || echo "MISSING mysql.env"
```

Type `confirmed` to proceed.

## Install

phpMyAdmin is included as a service in the MySQL compose stack. Start it alongside MySQL:

```bash
cd /opt/cortexos/stacks/mysql
docker compose --env-file /opt/cortexos/.secrets/mysql.env up -d --remove-orphans phpmyadmin
```

## Verify

```bash
curl -fsS http://127.0.0.1:8082/ >/dev/null && echo OK
```

Expected: phpMyAdmin login page responds with HTTP 200.

phpMyAdmin authentication uses MySQL credentials. Login with user `root` and the `MYSQL_ROOT_PASSWORD` from `/opt/cortexos/.secrets/mysql.env`.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:8082/` return 200, and does the Caddy `/phpmyadmin` route load the login page from the tailnet?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/mysql
docker compose stop phpmyadmin
docker compose rm -f phpmyadmin
```

MySQL data volumes are not affected.

## Next

→ `prompts/tools/70-dashboard.md`
