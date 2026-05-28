# 14a - Home Assistant

> **OPTIONAL** — Install only if local automation integrations are needed.

## Purpose

Run Home Assistant for local automation integrations. Live container: `cortex-home-assistant` with host networking on port 8123.

## Install mode

Docker with host networking. Home Assistant requires mDNS/SSDP discovery, which needs host network access.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 8123 free (or Tailscale Serve is the only listener on tailnet IP)
- [ ] Copy `stacks/home-assistant/docker-compose.yml`
- [ ] `docker compose up -d --remove-orphans`
- [ ] Configure `/config/configuration.yaml` trusted proxies for Tailscale Serve
- [ ] CHECKPOINT 2 confirmed — onboarding UI loads

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 8123` print no output, or is only Tailscale Serve listening on the tailnet IP for that port?

```bash
ss -tlnp | grep 8123
```

Type `confirmed` to proceed.

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/home-assistant
sudo cp -a stacks/home-assistant/. /opt/cortexos/stacks/home-assistant/
cd /opt/cortexos/stacks/home-assistant
docker compose up -d --remove-orphans
```

## Configure trusted proxies

If Tailscale Serve owns the tailnet-IP listener on port 8123, bind Home Assistant to loopback and add the proxy trust config:

```yaml
# /opt/cortexos/stacks/home-assistant/config/configuration.yaml
http:
  server_host: 127.0.0.1
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 100.64.0.0/10
    - 172.16.0.0/12
```

Restart after writing config:

```bash
docker restart cortex-home-assistant
```

## Verify

```bash
curl -fsSL http://127.0.0.1:8123/ | grep -i 'Home Assistant'
```

Expected: Home Assistant onboarding UI HTML returned.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:8123/` load the Home Assistant onboarding (or main) UI from a tailnet device?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/home-assistant
docker compose down
```

Home Assistant config volume is preserved. Pass `-v` to also remove it.

## Next

→ `prompts/tools/14b-jellyfin.md`
