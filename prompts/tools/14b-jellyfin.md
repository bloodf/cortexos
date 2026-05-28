# 14b - Jellyfin

> **OPTIONAL** — Install only if a media server is needed.

## Purpose

Run Jellyfin media server with persistent config and cache volumes. Live container: `cortex-jellyfin` on port 8096.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 8096 free, media path exists or is intentionally empty
- [ ] Copy `stacks/jellyfin/docker-compose.yml`
- [ ] `docker compose up -d --remove-orphans`
- [ ] CHECKPOINT 2 confirmed — `/health` returns `Healthy`

## CHECKPOINT 1

**STOP — operator questions:**

1. Does `ss -tlnp | grep 8096` print no output (port 8096 free)?

   ```bash
   ss -tlnp | grep 8096
   ```

2. What path should Jellyfin use for media files? (default: `/opt/cortexos/media`)

   The directory will be created if it does not exist.

Wait for the operator's answers. Replace `{MEDIA_PATH}` in the commands below with the confirmed path.

Type `confirmed` to proceed.

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/jellyfin {MEDIA_PATH}
sudo cp -a stacks/jellyfin/. /opt/cortexos/stacks/jellyfin/
cd /opt/cortexos/stacks/jellyfin
docker compose up -d --remove-orphans
```

## Verify

```bash
curl -fsS http://127.0.0.1:8096/health
```

Expected: `Healthy`.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:8096/health` return `Healthy`, and does `https://${CORTEX_DOMAIN}:8096/` load Jellyfin from a tailnet device?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/jellyfin
docker compose down
```

Config and cache volumes are preserved. Pass `-v` to also remove them.

## Next

→ `prompts/tools/15-redis.md`
