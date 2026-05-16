# Caddy (latest)

## Purpose
Install Caddy as the HTTPS reverse proxy; configure automatic TLS for `{DOMAIN}` and route traffic to CortexOS services.

## Prerequisites
- `12-tailscale.md` completed.
- DNS A record for `{DOMAIN}` pointing to the VPS public IP (or Tailscale IP if Tailscale-only).
- Port 80 and 443 open in UFW.

## CHECKPOINT 1
Operator: confirm DNS is propagated (`dig +short {DOMAIN}` returns the correct IP) and ports 80/443 are open. Type "confirmed" to proceed.

## Install

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update -y
sudo apt-get install -y caddy
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

Open UFW ports:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
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
