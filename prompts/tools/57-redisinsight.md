# RedisInsight

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Run RedisInsight for Redis administration.

## Install mode

Docker. DB admin UIs are containerized. Persistent data MUST use named volumes.

## Prerequisites

- `15-redis.md` completed.
- `INSTALL_REDISINSIGHT=yes`.

## Todo

- [ ] CHECKPOINT 1 confirmed — Redis reachable + port 5540 free
- [ ] Copy `stacks/redis-insight/docker-compose.yml`
- [ ] `docker compose up -d --remove-orphans`
- [ ] Confirm UI responds and add CortexOS Redis via RedisInsight API

## Verify + configure databases

```bash
curl -fsS http://127.0.0.1:5540 >/dev/null
docker network connect cortex-db cortex-redisinsight 2>/dev/null || true
curl -fsS http://127.0.0.1:5540/api/databases
```

Add databases through `POST /api/databases` if absent:

- CortexOS Redis: host `redis`, port `6379`, password from the running `cortex-redis` env.

RedisInsight is exposed through Tailscale Serve at `https://${CORTEX_DOMAIN}:5540/`.

## CHECKPOINT 2

Confirm direct URL loads over tailnet.
