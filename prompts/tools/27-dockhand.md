# Dockhand

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Run Dockge as Dockhand for Docker Compose stack management.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 3420 free
- [ ] Copy `stacks/dockhand/docker-compose.yml`
- [ ] Start the stack with `docker compose up -d --remove-orphans`
- [ ] Confirm Dockhand loads; create the first user in the UI if no user exists

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 3420` print no output (port 3420 free)?

Type `confirmed` to proceed.

## Install

```bash
cd /opt/cortexos/stacks/dockhand
docker compose up -d --remove-orphans
```

## Verify

```bash
curl -fsS http://127.0.0.1:3420 >/dev/null
```

Expected: Dockge/Dockhand UI responds. Dockge has no env-var auth bootstrap; first user is created through the setup UI. If a user already exists, use the existing account or reset/update the SQLite `user` row with Dockge's password hash helper.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:3420/` load Dockhand from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/28-floci.md`
