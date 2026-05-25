# Cockpit

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Install Cockpit for native Linux host administration over the tailnet.

## Install mode

Native package + systemd socket.

## Prerequisites

- `10-os-hardening.md` completed.
- `13-tailscale-serve.md` route will expose port 9091 over tailnet HTTPS.

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — port 9091 free or already Cockpit
- [ ] Install Cockpit package
- [ ] Enable `cockpit.socket`
- [ ] Configure Cockpit CSP origins for `${CORTEX_DOMAIN}:9091`
- [ ] Confirm local HTTPS endpoint responds

## CHECKPOINT 1

**STOP — operator question:** Is port 9091 free or already owned by Cockpit?

Type `confirmed` to proceed.

## Install

```bash
source scripts/pkg.sh
pkg_install cockpit
sudo mkdir -p /etc/systemd/system/cockpit.socket.d
sudo tee /etc/systemd/system/cockpit.socket.d/listen.conf >/dev/null <<'EOF'
[Socket]
ListenStream=
ListenStream=9091
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now cockpit.socket
sudo install -d -m 0755 /etc/cockpit
sudo tee /etc/cockpit/cockpit.conf >/dev/null <<EOF
[WebService]
Origins = https://${CORTEX_DOMAIN}:9091
EOF

sudo systemctl restart cockpit.socket
```

## Verify

```bash
curl -kfsS https://127.0.0.1:9091 >/dev/null
```

Expected: Cockpit responds. Sign in with a Linux user. The `Origins` entry is required; otherwise Cockpit WebSockets can be blocked by CSP when accessed through Tailscale Serve.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:9091/` load Cockpit from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/26a-otel-collector.md`
