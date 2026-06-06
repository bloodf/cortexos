# MongoDB (latest) — CONDITIONAL

## Purpose

Run MongoDB as a Docker container for workloads that require document storage. **This spoke is optional** — only execute if the SETUP.md questionnaire had `mongodb=yes`.

## Prerequisites

- `11-docker.md` completed.
- SETUP.md questionnaire: `mongodb=yes`.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
if [ "$(pkg_family)" = "unknown" ]; then
    echo "WARNING: OS family not detected. Run prompts/os/00-os-selection.md first."
fi
```

> **Ubuntu/Debian note.** MongoDB is installed via the Docker-Compose stack below. If you need the `mongosh` CLI on the host, install via the official MongoDB apt repo or use `docker run --rm -it mongo:7 mongosh ...`.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — MongoDB needed and port 27017 free
- [ ] Write `/opt/cortexos/stacks/mongodb/docker-compose.yml` (image `mongo`, root user env)
- [ ] Write `/opt/cortexos/.secrets/mongodb.env` (mode 0600)
- [ ] `docker compose --env-file /opt/cortexos/.secrets/mongodb.env up -d`
- [ ] Confirm `mongosh --eval "db.adminCommand('ping')"` returns `{ ok: 1 }`
- [ ] CHECKPOINT 2 confirmed — ping returned `{ ok: 1 }`

## CHECKPOINT 1

**STOP — operator question:** Is `mongodb=yes` set in your SETUP.md questionnaire (i.e. MongoDB is required for this install)?

Type `confirmed` to proceed. If `mongodb=no`, skip this spoke entirely and proceed to `17-dnsmasq.md`.

## CHECKPOINT 1b

**STOP — operator question:** Does `ss -tlnp | grep 27017` print no output (port 27017 free)?

Type `confirmed` to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/mongodb
tee /opt/cortexos/stacks/mongodb/docker-compose.yml <<'EOF'
services:
  mongodb:
    image: mongo:7
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    ports:
      - "127.0.0.1:27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
EOF
```

Write env file:

```bash
sudo tee /opt/cortexos/.secrets/mongodb.env <<EOF
MONGO_ROOT_USER={MONGO_ROOT_USER}
MONGO_ROOT_PASSWORD={MONGO_ROOT_PASSWORD}
EOF
sudo chmod 600 /opt/cortexos/.secrets/mongodb.env
```

## Configure

```bash
cd /opt/cortexos/stacks/mongodb
docker compose --env-file /opt/cortexos/.secrets/mongodb.env up -d
```

## Verify

```bash
docker exec $(docker compose -p mongodb ps -q mongodb) \
  mongosh --quiet --eval "db.adminCommand('ping')" \
  -u {MONGO_ROOT_USER} -p {MONGO_ROOT_PASSWORD} --authenticationDatabase admin
```

Expected: `{ ok: 1 }`.

## CHECKPOINT 2

**STOP — operator question:** Did `mongosh ... --eval "db.adminCommand('ping')"` print `{ ok: 1 }` (not an auth error, not connection refused) and `docker compose -p mongodb ps` show the service `running`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/20-prometheus.md` (Observability phase)
