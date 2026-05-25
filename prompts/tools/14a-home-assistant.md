# Home Assistant

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Run Home Assistant for local automation integrations.

## Install mode

Docker with host networking. Home Assistant needs mDNS/SSDP discovery.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 8123 free, or only Tailscale Serve is listening on the tailnet IP
- [ ] Copy `stacks/home-assistant/docker-compose.yml`
- [ ] Start the stack with `docker compose up -d`
- [ ] Configure `/config/configuration.yaml` trusted proxies for Tailscale Serve
- [ ] Confirm the first-run wizard loads

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 8123` print no output (port 8123 free)?

Type `confirmed` to proceed.

## Install

```bash
cd /opt/cortexos/stacks/home-assistant
docker compose up -d
```

## Configure + verify

Home Assistant runs with host networking. If Tailscale Serve owns the tailnet-IP listener on `8123`, bind Home Assistant to loopback and trust the proxy:

```yaml
http:
  server_host: 127.0.0.1
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 100.64.0.0/10
    - 172.16.0.0/12
```

Restart Home Assistant after writing config:

```bash
docker restart cortex-home-assistant
curl -fsSL http://127.0.0.1:8123/ | grep -i 'Home Assistant'
```

Expected: Home Assistant responds with the onboarding UI.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:8123/` load the Home Assistant onboarding UI from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/14b-jellyfin.md`
