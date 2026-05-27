# Tailscale Port Routing (latest)

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Publish CortexOS web UIs on dedicated HTTPS ports through **Tailscale Serve**.
Dashboard remains at the CortexOS tailnet domain root; every other UI uses its
own tailnet port, not a shared path.

Tailscale issues and rotates certificates automatically for the node's MagicDNS
FQDN — **no public DNS, no Let's Encrypt, no public firewall ports required**.

The CortexOS domain for a Tailscale-only install is the node's MagicDNS FQDN,
e.g. `<machine>.<tailnet>.ts.net` (printed by `tailscale status`).

## Prerequisites

- `12-tailscale.md` completed — node is online in your tailnet.
- MagicDNS + HTTPS certs enabled in your Tailscale admin console
  (`Admin → DNS → MagicDNS = on`, `Admin → DNS → HTTPS Certificates = on`).
- The operator can provide the node's tailnet FQDN when asked below.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — Tailscale HTTPS certs enabled + MagicDNS name resolves
- [ ] Remove old path-based Tailscale Serve route
- [ ] Publish Dashboard on HTTPS 443
- [ ] Publish installed service UIs on their native HTTPS ports
- [ ] Confirm `tailscale serve status` lists port mappings, not path handlers
- [ ] CHECKPOINT 2 confirmed — dashboard route published
- [ ] CHECKPOINT 3 confirmed — service port routes published

## CHECKPOINT 1

**STOP — operator question:** In the Tailscale admin console, are both `Admin → DNS → MagicDNS` and `Admin → DNS → HTTPS Certificates` toggled **on**, AND does `tailscale status` print this node as `online` with a MagicDNS FQDN (not `offline`, not blank)?

Type `confirmed` to proceed.

## Input Gate — Tailnet Domain

**STOP — input question:** What is this node's MagicDNS FQDN from
`tailscale status`?

Do not continue until the operator answers. After the answer, substitute it for
`<cortex_domain_from_chat>` in the commands and URL map below.

## Publish over Tailscale

Reset any old path-based Serve config, then publish each local service on a
dedicated HTTPS port:

```bash
CORTEX_DOMAIN='<cortex_domain_from_chat>'

# Issue the node cert on first call (idempotent, refreshes on its own).
sudo tailscale cert "${CORTEX_DOMAIN}"

# Remove the old path-based route before publishing port routes.
sudo tailscale serve reset

# Dashboard stays at the origin root.
sudo tailscale serve --bg --https=443 http://localhost:3080

# Operator-facing service UIs/APIs use ports, not paths.
sudo tailscale serve --bg --https=11434 http://localhost:11434  # 9Router
sudo tailscale serve --bg --https=3000  http://localhost:3000   # Grafana
sudo tailscale serve --bg --https=9090  http://localhost:9090   # Prometheus
sudo tailscale serve --bg --https=3100  http://localhost:3100   # Loki API
sudo tailscale serve --bg --https=8081  http://localhost:8081   # cAdvisor
sudo tailscale serve --bg --https=3001  http://localhost:3001   # Langfuse
sudo tailscale serve --bg --https=18690 http://localhost:18690  # Honcho API
sudo tailscale serve --bg --https=18691 http://localhost:18691  # Hermes primary API
sudo tailscale serve --bg --https=18692 http://localhost:18692  # Hermes secondary API
sudo tailscale serve --bg --https=3333  http://localhost:3333   # Kernel Browser
sudo tailscale serve --bg --https=5050  http://localhost:5050   # pgAdmin
sudo tailscale serve --bg --https=5540  http://localhost:5540   # RedisInsight
sudo tailscale serve --bg --https=8083  http://localhost:8083   # mongo-express
sudo tailscale serve --bg --https=8082  http://localhost:8082   # phpMyAdmin
sudo tailscale serve --bg --https=9091  http://localhost:9091   # Cockpit
sudo tailscale serve --bg --https=3420  http://localhost:3420   # Dockhand
sudo tailscale serve --bg --https=4566  http://localhost:4566   # Floci / LocalStack API
sudo tailscale serve --bg --https=8123  http://localhost:8123   # Home Assistant
sudo tailscale serve --bg --https=8096  http://localhost:8096   # Jellyfin
sudo tailscale serve --bg --https=10000 https+insecure://127.0.0.1:10000 # Webmin

sudo tailscale serve status
```

Do **not** open these ports in the host firewall — Tailscale Serve listens on
the tailnet interface only.

## URL map

| Service | Tailnet URL |
|---|---|
| Cortex Dashboard | `https://${CORTEX_DOMAIN}/` |
| 9Router | `https://${CORTEX_DOMAIN}:11434/dashboard` |
| Grafana | `https://${CORTEX_DOMAIN}:3000/` |
| Prometheus | `https://${CORTEX_DOMAIN}:9090/` |
| Loki API | `https://${CORTEX_DOMAIN}:3100/` |
| cAdvisor | `https://${CORTEX_DOMAIN}:8081/` |
| Langfuse | `https://${CORTEX_DOMAIN}:3001/` |
| Honcho API | `https://${CORTEX_DOMAIN}:18690/` |
| Hermes Primary API | `https://${CORTEX_DOMAIN}:18691/v1/` |
| Hermes Secondary API | `https://${CORTEX_DOMAIN}:18692/v1/` |
| Kernel Browser | `https://${CORTEX_DOMAIN}:3333/json/version?token={KERNEL_BROWSER_TOKEN}` |
| pgAdmin | `https://${CORTEX_DOMAIN}:5050/` |
| RedisInsight | `https://${CORTEX_DOMAIN}:5540/` |
| mongo-express | `https://${CORTEX_DOMAIN}:8083/` |
| phpMyAdmin | `https://${CORTEX_DOMAIN}:8082/` |
| Cockpit | `https://${CORTEX_DOMAIN}:9091/` |
| Dockhand | `https://${CORTEX_DOMAIN}:3420/` |
| Floci / LocalStack | `https://${CORTEX_DOMAIN}:4566/_localstack/health` |
| Home Assistant | `https://${CORTEX_DOMAIN}:8123/` |
| Jellyfin | `https://${CORTEX_DOMAIN}:8096/` |
| Webmin | `https://${CORTEX_DOMAIN}:10000/` |

## Verify

Per [prompts/CHECKPOINT-PATTERN.md](../CHECKPOINT-PATTERN.md), this spoke
verifies only Tailscale Serve routes. Downstream health checks belong to each
service's own spoke and to `99-final-validation`.

```bash
sudo tailscale serve status

curl -kI "https://${CORTEX_DOMAIN}/"
curl -kI "https://${CORTEX_DOMAIN}:11434/dashboard"
```

Expected: Serve status lists port handlers such as
`https://${CORTEX_DOMAIN}:11434/`, and both curl commands return `2xx` or `3xx`.

## CHECKPOINT 2

**STOP — operator question:** Does `sudo tailscale serve status` list `https://${CORTEX_DOMAIN}` forwarding to `http://localhost:3080`?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** From a second tailnet device, does `curl -kI https://${CORTEX_DOMAIN}:11434/dashboard` return HTTP `2xx` or `3xx`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/14-postgresql.md`
