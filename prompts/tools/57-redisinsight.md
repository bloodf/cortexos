# RedisInsight

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
- [ ] `docker compose up -d`
- [ ] Confirm direct URL responds

## Verify

```bash
curl -fsS http://127.0.0.1:5540 >/dev/null
```

RedisInsight is direct-IP only: `http://100.109.20.9:5540`.

## CHECKPOINT 2

Confirm direct URL loads over tailnet.
