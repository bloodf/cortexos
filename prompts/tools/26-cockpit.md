# Cockpit

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
```

## Verify

```bash
curl -kfsS https://127.0.0.1:9091 >/dev/null
```

Expected: Cockpit responds. Sign in with a Linux user.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:9091/` load Cockpit from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/26a-otel-collector.md`
