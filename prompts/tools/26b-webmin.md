# Webmin

## Purpose

Install Webmin for Linux host administration over the tailnet.

## Install mode

Native apt repository package.

## Prerequisites

- `10-os-hardening.md` completed.
- `13-tailscale-serve.md` route will expose port 10000 over tailnet HTTPS.

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — port 10000 free or already Webmin
- [ ] Install Webmin repository package
- [ ] Enable Webmin service
- [ ] Confirm local HTTPS endpoint responds

## CHECKPOINT 1

**STOP — operator question:** Is port 10000 free or already owned by Webmin?

Type `confirmed` to proceed.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/webmin/webmin/master/setup-repos.sh -o /tmp/webmin-setup-repos.sh
sudo sh /tmp/webmin-setup-repos.sh
source scripts/pkg.sh
pkg_install webmin
sudo systemctl enable --now webmin
```

## Verify

```bash
curl -kfsS https://127.0.0.1:10000 >/dev/null
```

Expected: Webmin responds. Sign in with a Linux user.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:10000/` load Webmin from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/27-dockhand.md`
