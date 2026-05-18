# Redis (latest)

## Purpose

Run Redis as a Docker container for session caching and ephemeral queue use by CortexOS services.

## Prerequisites

- `11-docker.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm port 6379 is not already in use (`ss -tlnp | grep 6379`). Type "confirmed" to proceed.

## Install

Create stack directory and compose file:

```bash
mkdir -p /opt/cortexos/stacks/redis
tee /opt/cortexos/stacks/redis/docker-compose.yml <<'EOF'
services:
  redis:
    image: redis
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

Operator: confirm Redis responds `PONG` and the container is running (`docker compose -p redis ps`). Type "confirmed" to proceed.

## Next

→ `prompts/tools/16-mongodb.md` (if MongoDB enabled) OR `prompts/tools/17-dnsmasq.md`
