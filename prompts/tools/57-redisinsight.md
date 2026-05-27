# RedisInsight

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

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
- [ ] Confirm UI responds and add CortexOS Redis + Honcho Redis via RedisInsight API

## Verify + configure databases

```bash
curl -fsS http://127.0.0.1:5540 >/dev/null
docker network connect cortex-db cortex-redisinsight 2>/dev/null || true
docker network connect honcho_default cortex-redisinsight 2>/dev/null || true
curl -fsS http://127.0.0.1:5540/api/databases
```

Add databases through `POST /api/databases` if absent:

- CortexOS Redis: host `redis`, port `6379`, password from the running `cortex-redis` env.
- Honcho Redis: host `honcho-redis`, port `6379`, no password unless the Honcho stack sets one.

RedisInsight is exposed through Tailscale Serve at `https://${CORTEX_DOMAIN}:5540/`.

## CHECKPOINT 2

Confirm direct URL loads over tailnet.
