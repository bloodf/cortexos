# Redis (latest)

## Purpose

Run Redis as a Docker container for session caching and ephemeral queue use by CortexOS services.

## Prerequisites

- `11-docker.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
if [ "$(pkg_family)" = "unknown" ]; then
    echo "WARNING: OS family not detected. Run prompts/os/00-os-selection.md first."
fi
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 6379 is free
- [ ] Write `/opt/cortexos/stacks/redis/docker-compose.yml` (image `redis`, `--requirepass`)
- [ ] Write `/opt/cortexos/.secrets/redis.env` (mode 0600) with `REDIS_PASSWORD`
- [ ] `docker compose --env-file /opt/cortexos/.secrets/redis.env up -d`
- [ ] Confirm `redis-cli -a $REDIS_PASSWORD ping` returns `PONG`
- [ ] CHECKPOINT 2 confirmed — Redis container running, PONG returned

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 6379` print no output (port 6379 free)?

Type `confirmed` to proceed.

## Install

Create stack directory and compose file:

```bash
mkdir -p /opt/cortexos/stacks/redis
tee /opt/cortexos/stacks/redis/docker-compose.yml <<'EOF'
services:
  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning --requirepass ${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
EOF
```

Write env file:

```bash
sudo tee /opt/cortexos/.secrets/redis.env <<EOF
REDIS_PASSWORD={REDIS_PASSWORD}
EOF
sudo chmod 600 /opt/cortexos/.secrets/redis.env
```

Replace `{REDIS_PASSWORD}` with a strong random password.

## Configure

```bash
cd /opt/cortexos/stacks/redis
docker compose --env-file /opt/cortexos/.secrets/redis.env up -d
```

## Verify

```bash
docker exec $(docker compose -p redis ps -q redis) \
  redis-cli -a {REDIS_PASSWORD} ping
```

Expected: `PONG`.

## CHECKPOINT 2

**STOP — operator question:** Did `redis-cli -a {REDIS_PASSWORD} ping` print `PONG` (not `NOAUTH` and not `Connection refused`), and does `docker compose -p redis ps` show the `redis` service as `running` (not `exited`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/16-mongodb.md` (if MongoDB enabled) OR `prompts/tools/16a-mysql.md` (if MySQL enabled)
