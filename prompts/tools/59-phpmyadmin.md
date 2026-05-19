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
- [ ] Confirm `/phpmyadmin/` returns 200 through Caddy

## Verify

```bash
curl -fsS http://127.0.0.1:8080/phpmyadmin/ >/dev/null
```

## CHECKPOINT 2

Confirm phpMyAdmin loads through `/phpmyadmin/`.
