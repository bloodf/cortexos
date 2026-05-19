# Caddy + Tailscale TLS (latest)

## Purpose

Run Caddy as a localhost-only HTTP reverse proxy for CortexOS services,
then publish it over the tailnet on HTTPS using **Tailscale Serve**.
Tailscale issues and rotates certificates automatically for the node's
MagicDNS FQDN — **no public DNS, no Let's Encrypt, no ports 80/443
exposed to the internet**.

`CORTEX_DOMAIN` for a Tailscale-only install is the node's MagicDNS
FQDN, e.g. `cortex.tailXXXX.ts.net` (printed by `tailscale status`).

## Prerequisites

- `12-tailscale.md` completed — node is online in your tailnet.
- MagicDNS + HTTPS certs enabled in your Tailscale admin console
  (`Admin → DNS → MagicDNS = on`, `Admin → DNS → HTTPS Certificates = on`).
- `${CORTEX_DOMAIN}` exported and set to the tailnet FQDN (or a public
  domain if you have one pointed at the Tailscale IP — both work the
  same here).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — Tailscale HTTPS certs enabled + MagicDNS name resolves
- [ ] `pkg_install caddy` via Cloudsmith apt repo
- [ ] Write `/etc/caddy/Caddyfile` (localhost :8080, path-based routes)
- [ ] `sudo systemctl enable caddy` + `sudo systemctl restart caddy`
- [ ] `sudo tailscale cert "${CORTEX_DOMAIN}"`
- [ ] `sudo tailscale serve --bg --https=443 http://localhost:8080`
- [ ] Confirm `ss -tlnp` shows Caddy bound on `127.0.0.1:8080`
- [ ] CHECKPOINT 2 confirmed — caddy active, tailscale serve route published
- [ ] (Optional) Public-domain override if not running Tailscale-only

## CHECKPOINT 1

**STOP — operator question:** In the Tailscale admin console, are both `Admin → DNS → MagicDNS` and `Admin → DNS → HTTPS Certificates` toggled **on**, AND does `tailscale status` print this node as `online` with a MagicDNS FQDN (not `offline`, not blank)?

Type `confirmed` to proceed.

## Install

```bash
pkg_install debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update -y -qq
pkg_install caddy
dpkg -s caddy >/dev/null
```

## Configure Caddy (localhost only, path-based routing)

MagicDNS issues exactly one hostname per node, so subdomain routing
(`grafana.<host>`) is not available on a Tailscale-only install. Use
**path-based** routing instead.

Write `/etc/caddy/Caddyfile`:

```caddyfile
{
  # Localhost-only; Tailscale Serve terminates TLS in front.
  auto_https off
  admin off
}

:8080 {
  handle /healthz {
    respond 200
  }

  # Dashboard at root
  handle /api/* {
    reverse_proxy localhost:3080
  }

  # Grafana — configured with GF_SERVER_SERVE_FROM_SUB_PATH=true,
  # so it expects /grafana in the URL. Do NOT strip_prefix.
  handle_path /grafana {
    redir /grafana/ permanent
  }
  handle /grafana/* {
    reverse_proxy localhost:3000
  }

  # Prometheus — started with --web.route-prefix=/prometheus, so it
  # expects /prometheus in the URL. Do NOT strip_prefix.
  handle_path /prometheus {
    redir /prometheus/ permanent
  }
  handle /prometheus/* {
    reverse_proxy localhost:9090
  }

  # Loki — HTTP API is path-agnostic. Strip the prefix.
  handle /loki/* {
    uri strip_prefix /loki
    reverse_proxy localhost:3100
  }

  # cAdvisor — started with --url_base_prefix=/cadvisor, so it
  # expects /cadvisor in the URL. Do NOT strip_prefix.
  # NOTE: cAdvisor is bound to host port 8081 to avoid clashing with
  # Caddy on 8080 (see prompts/tools/24-cadvisor.md).
  handle_path /cadvisor {
    redir /cadvisor/ permanent
  }
  handle /cadvisor/* {
    reverse_proxy localhost:8081
  }

  # NATS — built-in HTTP monitoring endpoint on :8222 exposes JSON status
  # pages (/varz, /connz, /jsz, /healthz). Path-agnostic — strip the prefix.
  handle /nats/* {
    uri strip_prefix /nats
    reverse_proxy localhost:8222
  }

  # 9Router WebUI and OpenAI-compatible API — Caddy strips /9router so the
  # upstream sees its native root paths.
  handle_path /9router {
    redir /9router/ permanent
  }
  handle /9router/* {
    uri strip_prefix /9router
    reverse_proxy localhost:11434
  }

  # OpenViking built-in web console/API
  handle_path /openviking {
    redir /openviking/ permanent
  }
  handle /openviking/* {
    uri strip_prefix /openviking
    reverse_proxy localhost:18790
  }

  # LEANN document-RAG API
  handle_path /leann {
    redir /leann/ permanent
  }
  handle /leann/* {
    uri strip_prefix /leann
    reverse_proxy localhost:18791
  }

  # Langfuse — Langfuse v3 does not natively support a sub-path
  # (no BASE_PATH / basePath env). NEXTAUTH_URL is set to the full
  # /langfuse URL and links are rewritten where possible, but some
  # absolute internal links (e.g. NextJS _next/static assets) may
  # break under a sub-path. If that bites, expose Langfuse on a
  # dedicated tailnet hostname instead. Do NOT strip_prefix here —
  # NEXTAUTH_URL carries the prefix and Langfuse routes off it.
  # Langfuse-web is bound to host port 3001 (see 55-langfuse.md)
  # because Grafana already owns 3000.
  handle_path /langfuse {
    redir /langfuse/ permanent
  }
  # Langfuse v3 lacks a full sub-path mode. Keep the general UI route
  # unstripped, but strip the prefix for the public health endpoint so
  # tailnet verification can still hit `/langfuse/api/public/health`.
  handle /langfuse/api/public/health {
    uri strip_prefix /langfuse
    reverse_proxy localhost:3001
  }
  handle /langfuse/* {
    reverse_proxy localhost:3001
  }

  handle {
    reverse_proxy localhost:3080
  }
}
```

Reload:

```bash
sudo systemctl enable caddy
sudo systemctl restart caddy
curl -fsS http://127.0.0.1:8080/healthz -o /dev/null -w "caddy-healthz: %{http_code}\n"
```

## Publish over Tailscale (HTTPS, auto cert)

```bash
# Issue the node cert on first call (idempotent, refreshes on its own)
sudo tailscale cert "${CORTEX_DOMAIN}"

# Background serve: HTTPS on 443 → Caddy on localhost:8080
sudo tailscale serve --bg --https=443 http://localhost:8080
sudo tailscale serve status
```

Do **not** open ports 80/443 in the host firewall — Tailscale Serve
listens on the tailnet interface only.

## Verify — Caddy and Tailscale Serve only

Per [prompts/CHECKPOINT-PATTERN.md](../CHECKPOINT-PATTERN.md), this spoke verifies **only state it owns**: the Caddy process, its localhost listener, and the Tailscale Serve route. Downstream service path probes (Grafana, Prometheus, Loki, cAdvisor, NATS, Langfuse) belong to each service's own spoke and to `99-final-validation`.

```bash
# Caddy process is up
systemctl is-active --quiet caddy && echo "caddy: active" || echo "caddy: INACTIVE"

# Caddy is listening on the localhost reverse-proxy port
ss -tlnp 2>/dev/null | grep -E '127\.0\.0\.1:8080|\*:8080|\[::1\]:8080' | head -1

# Caddy's own healthz responds locally (the catch-all dashboard upstream
# is not yet running, so probe Caddy's own /healthz endpoint, not a
# service route).
curl -fsS http://127.0.0.1:8080/healthz -o /dev/null -w "caddy-healthz: %{http_code}\n" || \
  curl -fsS -o /dev/null -w "caddy-root: %{http_code}\n" http://127.0.0.1:8080/

# Tailscale Serve route is published for this node
sudo tailscale serve status
```

Expected: `caddy: active`, a listener bound on `127.0.0.1:8080`, an HTTP
response from Caddy (any `2xx`/`3xx`/`502` is fine — `502` only means
upstream dashboard is not yet installed; Caddy itself is up), and
`tailscale serve status` lists `https://${CORTEX_DOMAIN}` → `http://localhost:8080`.

> Path probes for Grafana, Prometheus, Loki, cAdvisor, NATS, and Langfuse
> are run by their owning spokes (`20-prometheus`, `21-loki`, `22-grafana`,
> `23-fluent-bit`, `24-cadvisor`, `30-nats`, `55-langfuse`) and consolidated
> in `99-final-validation`. Do not probe them here.

## CHECKPOINT 2

**STOP — operator question:** Does `systemctl is-active caddy` print `active` (not `inactive`, not `failed`)?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** Does `sudo tailscale serve status` list a route `https=443 → http://localhost:8080` for `${CORTEX_DOMAIN}` (not empty output)?

Type `confirmed` to proceed.

## CHECKPOINT 4

**STOP — operator question:** From a second tailnet device, does `curl -kI https://${CORTEX_DOMAIN}/` return HTTP `2xx`, `3xx`, or `502` (a `502` is acceptable — dashboard not installed yet; a connection refused / DNS failure is NOT acceptable)?

Type `confirmed` to proceed.

## Public-domain override (optional)

If you have a real domain pointed at the VPS public IP **and** want it
served publicly (not just over Tailscale):

1. Re-enable Caddy's auto-HTTPS block in the Caddyfile with
   `${CORTEX_DOMAIN}` and remove the `:8080` block.
2. Open `firewall_open 80 tcp` and `firewall_open 443 tcp`.
3. Skip the `tailscale serve` step.

For a homelab the Tailscale path is preferred — zero public surface.

## Next

→ `prompts/tools/14-postgresql.md`
