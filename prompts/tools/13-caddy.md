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

## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure Caddy (localhost only, path-based routing)
- [ ] Publish over Tailscale (HTTPS, auto cert)
- [ ] Verify — Caddy and Tailscale Serve only
- [ ] CHECKPOINT 2 confirmed
- [ ] Public-domain override (optional)

## CHECKPOINT 1

**STOP — operator question:** Tailscale HTTPS certificates are enabled in your?

Operator: confirm Tailscale HTTPS certificates are enabled in your
admin console and `tailscale status` shows the node online with a
MagicDNS name.

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
curl -sS http://127.0.0.1:8080/ -o /dev/null -w "caddy: %{http_code}\n"
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

**STOP — operator question:** `systemctl is-active caddy` returns `active`, that?

Operator: confirm `systemctl is-active caddy` returns `active`, that
`tailscale serve status` shows the `https=443 → http://localhost:8080`
route for `${CORTEX_DOMAIN}`, and that a second tailnet device can reach
`https://${CORTEX_DOMAIN}/` (a `502` is acceptable here — the dashboard
upstream is installed later by `70-dashboard.md`).

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
