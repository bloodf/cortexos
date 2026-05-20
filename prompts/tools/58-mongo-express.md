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
- [ ] Confirm `https://${CORTEX_DOMAIN}:8083/` requires auth or loads UI

## Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8083/
```

Expected: `200` after basic auth or `401` before auth.

## CHECKPOINT 2

Confirm the tailnet port reaches mongo-express.
