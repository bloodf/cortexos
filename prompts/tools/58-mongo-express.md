# mongo-express

## Purpose

Run mongo-express for MongoDB administration.

## Install mode

Docker. DB admin UIs are containerized.

## Prerequisites

- `16-mongodb.md` completed.
- `INSTALL_MONGO_EXPRESS=yes`.

## Todo

- [ ] CHECKPOINT 1 confirmed — MongoDB enabled
- [ ] Use `stacks/mongodb/docker-compose.yml` with `mongo-express` service
- [ ] Write the compose-resolved `.secrets/mongodb.env` with Mongo root + mongo-express basic-auth vars
- [ ] Confirm `https://${CORTEX_DOMAIN}:8083/` requires basic auth and works with configured credentials

## Configure + verify

Required env keys:

```bash
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=<random>
ME_CONFIG_MONGODB_ADMINUSERNAME=admin
ME_CONFIG_MONGODB_ADMINPASSWORD=<same-as-root-password>
ME_CONFIG_BASICAUTH_USERNAME=<operator-user>
ME_CONFIG_BASICAUTH_PASSWORD=<random>
ME_CONFIG_MONGODB_URL=mongodb://admin:<root-password>@mongodb:27017/
```

`env_file: ../../.secrets/mongodb.env` resolves relative to the compose file's project path; confirm with `docker compose config --no-interpolate` before restarting.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8083/
curl -fsS -u "${ME_CONFIG_BASICAUTH_USERNAME}:${ME_CONFIG_BASICAUTH_PASSWORD}" http://localhost:8083/ >/dev/null
```

Expected: `401` before basic auth; `200` with basic auth. Existing Mongo volumes keep the original root user; if credentials are changed after first boot, create/update that Mongo admin user before restarting mongo-express.

## CHECKPOINT 2

Confirm the tailnet port reaches mongo-express.
