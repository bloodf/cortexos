# MongoDB (latest) — CONDITIONAL

## Purpose
Run MongoDB as a Docker container for workloads that require document storage. **This spoke is optional** — only execute if the SETUP.md questionnaire had `mongodb=yes`.

## Prerequisites
- `11-docker.md` completed.
- SETUP.md questionnaire: `mongodb=yes`.

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
