# Home Assistant

## Purpose

Run Home Assistant for local automation integrations.

## Install mode

Docker with host networking. Home Assistant needs mDNS/SSDP discovery.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 8123 free
- [ ] Copy `stacks/home-assistant/docker-compose.yml`
- [ ] Start the stack with `docker compose up -d`
- [ ] Confirm the first-run wizard loads

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 8123` print no output (port 8123 free)?

Type `confirmed` to proceed.

## Install

```bash
cd /opt/cortexos/stacks/home-assistant
docker compose up -d
```

## Verify

```bash
curl -fsS http://127.0.0.1:8123 >/dev/null
```

Expected: Home Assistant responds with the onboarding UI.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:8123/` load the Home Assistant onboarding UI from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/14b-jellyfin.md`
