# Dockhand

## Purpose

Run Dockge as Dockhand for Docker Compose stack management.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 3420 free
- [ ] Copy `stacks/dockhand/docker-compose.yml`
- [ ] Start the stack with `docker compose up -d`
- [ ] Confirm Dockhand loads

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 3420` print no output (port 3420 free)?

Type `confirmed` to proceed.

## Install

```bash
cd /opt/cortexos/stacks/dockhand
docker compose up -d
```

## Verify

```bash
curl -fsS http://127.0.0.1:3420 >/dev/null
```

Expected: Dockge/Dockhand UI responds.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:3420/` load Dockhand from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/28-floci.md`
