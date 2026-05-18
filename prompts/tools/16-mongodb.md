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
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

> **Fedora/RHEL note.** MongoDB upstream publishes only RHEL repos (`https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/`); there is no official Fedora repo. The Docker-Compose stack below sidesteps the repo gap entirely.
>
> If you need the `mongosh` CLI on the host:
>
> - **Fedora**: no upstream package — pull `mongosh` from the rhel9 repo manually, or `docker run --rm -it mongo:7 mongosh ...`.
> - **RHEL / Rocky / AlmaLinux 9**: the upstream `mongodb-org` repo for `rhel9` exists and ships `mongodb-mongosh`. Add the repo file (see <https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-red-hat/>) and `pkg_install mongodb-mongosh`. See `docs/RHEL-FAMILY-SUPPORT.md` for the package gap table.

## CHECKPOINT 1

Operator: confirm MongoDB is required for your workloads and port 27017 is free (`ss -tlnp | grep 27017`). If MongoDB is not needed, skip this spoke and proceed to `17-dnsmasq.md`. Type "confirmed" to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/mongodb
tee /opt/cortexos/stacks/mongodb/docker-compose.yml <<'EOF'
services:
  mongodb:
    image: mongo
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

Operator: confirm MongoDB responds with `{ ok: 1 }` and the container is running. Type "confirmed" to proceed.

## Next

→ `prompts/tools/17-dnsmasq.md`
