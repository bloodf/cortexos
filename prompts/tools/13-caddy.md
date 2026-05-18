# Caddy (latest)

## Purpose

Install Caddy as the HTTPS reverse proxy; configure automatic TLS for `{DOMAIN}` and route traffic to CortexOS services.

## Prerequisites

- `12-tailscale.md` completed.
- DNS A record for `{DOMAIN}` pointing to the VPS public IP (or Tailscale IP if Tailscale-only).
- Ports 80 and 443 open in the host firewall.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm DNS is propagated (`dig +short {DOMAIN}` returns the correct IP) and ports 80/443 are open. Type "confirmed" to proceed.

## Install

```bash
if [ "$(pkg_family)" = "ubuntu" ]; then
  pkg_install debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -y -qq
  pkg_install caddy
elif [ "$(pkg_family)" = "fedora" ]; then
  sudo dnf copr enable -y @caddy/caddy
  pkg_install caddy
elif [ "$(pkg_family)" = "rhel" ]; then
  # CRB + EPEL are enabled by prompts/os/10-rhel-prereqs.md.
  # EPEL ships `caddy` for el9; prefer it over copr (copr coverage for
  # rhel9 is patchy on Rocky/Alma — see docs/RHEL-FAMILY-SUPPORT.md).
  case "$(pkg_subfamily)" in
    rocky|almalinux|centos)
      # EPEL caddy is reliable here.
      pkg_install caddy
      ;;
    rhel)
      # Try EPEL first; fall back to copr if the operator opted in to coprs.
      pkg_install caddy || {
        sudo dnf copr enable -y @caddy/caddy
        pkg_install caddy
      }
      ;;
    *)
      pkg_install caddy
      ;;
  esac
fi
```

Verify package install (family-appropriate):

```bash
if [ "$(pkg_family)" = "ubuntu" ]; then dpkg -s caddy >/dev/null; else rpm -qi caddy >/dev/null; fi
```

## Configure

Write `/etc/caddy/Caddyfile`:

```caddyfile
{DOMAIN} {
  reverse_proxy /api/* localhost:3080
  reverse_proxy localhost:3080
}

# Grafana
grafana.{DOMAIN} {
  reverse_proxy localhost:3000
}

# Prometheus (internal only — restrict by IP or Tailscale)
prometheus.{DOMAIN} {
  reverse_proxy localhost:9090
}
```

Reload:

```bash
sudo systemctl enable caddy
sudo systemctl reload caddy
```

Open firewall ports:

```bash
firewall_open 80 tcp
firewall_open 443 tcp
```

## Verify

```bash
curl -sSo /dev/null -w "%{http_code}" https://{DOMAIN}/
```

Expected: `200` (or `302`/`301` depending on app). Certificate auto-provisioned by Caddy via Let's Encrypt.

## CHECKPOINT 2

Operator: confirm HTTPS is working at `https://{DOMAIN}/` and no certificate errors appear. Type "confirmed" to proceed.

## Next

→ `prompts/tools/14-postgresql.md`
