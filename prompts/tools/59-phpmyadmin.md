# phpMyAdmin

## Purpose

Run phpMyAdmin for MySQL administration.

## Install mode

Docker. DB admin UIs are containerized.

## Prerequisites

- `16a-mysql.md` completed.
- `INSTALL_PHPMYADMIN=yes`.

## Todo

- [ ] CHECKPOINT 1 confirmed — MySQL enabled
- [ ] Use `stacks/mysql/docker-compose.yml` with `phpmyadmin` service
- [ ] Ensure `MYSQL_ROOT_PASSWORD` exists in the compose-resolved `.secrets/mysql.env`
- [ ] Confirm `https://${CORTEX_DOMAIN}:8082/` returns 200 through Tailscale Serve

## Verify

phpMyAdmin auth is MySQL auth. Login with user `root` and `MYSQL_ROOT_PASSWORD` from the compose-resolved `.secrets/mysql.env`.

```bash
curl -fsS http://127.0.0.1:8082/ >/dev/null
```

## CHECKPOINT 2

Confirm phpMyAdmin loads through the tailnet port.
