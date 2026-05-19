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

## CHECKPOINT 1

Operator: confirm Tailscale HTTPS certificates are enabled in your
admin console and `tailscale status` shows the node online with a
MagicDNS name. Type "confirmed" to proceed.

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

## Verify

```bash
curl -sS "https://${CORTEX_DOMAIN}/" -o /dev/null -w "ts-serve:   %{http_code}\n"
curl -sS "https://${CORTEX_DOMAIN}/grafana/"    -o /dev/null -w "grafana:    %{http_code}\n"
curl -sS "https://${CORTEX_DOMAIN}/prometheus/" -o /dev/null -w "prometheus: %{http_code}\n"
curl -sS "https://${CORTEX_DOMAIN}/loki/ready"  -o /dev/null -w "loki:       %{http_code}\n"
curl -sS "https://${CORTEX_DOMAIN}/cadvisor/"   -o /dev/null -w "cadvisor:   %{http_code}\n"
curl -sS "https://${CORTEX_DOMAIN}/nats/varz"   -o /dev/null -w "nats:       %{http_code}\n"
curl -sS "https://${CORTEX_DOMAIN}/langfuse/"   -o /dev/null -w "langfuse:   %{http_code}\n"
```

Expected: `200`/`302` with no certificate errors. The browser should
trust the cert (issued by Let's Encrypt via Tailscale's ACME proxy
against the `*.ts.net` zone).

## CHECKPOINT 2

Operator: from a second tailnet device, confirm `https://${CORTEX_DOMAIN}/`
loads the dashboard with a valid certificate and no warnings. Type
"confirmed" to proceed.

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
