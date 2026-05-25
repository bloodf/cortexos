# phpMyAdmin

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

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
