# Jellyfin

## Purpose

Run Jellyfin media server on localhost with persistent config/cache volumes.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 8096 free + media path exists or is intentionally empty
- [ ] Copy `stacks/jellyfin/docker-compose.yml`
- [ ] Start the stack with `docker compose up -d`
- [ ] Confirm the first-run wizard loads

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 8096` print no output (port 8096 free)?

Type `confirmed` to proceed.

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/media
cd /opt/cortexos/stacks/jellyfin
docker compose up -d
```

## Verify

```bash
curl -fsS http://127.0.0.1:8096/health
```

Expected: `Healthy`.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:8096/` load Jellyfin from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/15-redis.md`
