# Webmin

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Install Webmin for Linux host administration over the tailnet.

## Install mode

Native apt repository package.

## Prerequisites

- `10-os-hardening.md` completed.
- `13-tailscale-serve.md` exposes tailnet port 10000.
- Webmin must bind only to `127.0.0.1:10000`; Tailscale Serve owns the
  tailnet listener and proxies to that loopback endpoint.

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] Install Webmin repository package
- [ ] Pin Webmin to loopback
- [ ] Enable Webmin service
- [ ] Confirm local HTTPS endpoint responds

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/webmin/webmin/master/setup-repos.sh -o /tmp/webmin-setup-repos.sh
sudo sh /tmp/webmin-setup-repos.sh
source scripts/pkg.sh
pkg_install webmin

# Tailscale Serve owns the tailnet :10000 listener. Keep Webmin local-only.
sudo systemctl stop webmin || true
if sudo grep -q '^bind=' /etc/webmin/miniserv.conf; then
  sudo sed -i 's/^bind=.*/bind=127.0.0.1/' /etc/webmin/miniserv.conf
else
  sudo sed -i '/^listen=10000$/a bind=127.0.0.1' /etc/webmin/miniserv.conf
fi

sudo systemctl enable --now webmin
```

## Verify

```bash
systemctl is-active --quiet webmin
curl -kfsS https://127.0.0.1:10000 >/dev/null
sudo ss -ltnp 'sport = :10000'
```

Expected: Webmin responds on `127.0.0.1:10000`. Tailscale may also own the
tailnet `:10000` address; Webmin must not.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:10000/` load Webmin from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/27-dockhand.md`
