# fail2ban (latest)

## Purpose

Install and configure fail2ban to ban IPs with repeated SSH authentication failures and protect Caddy-proxied HTTP endpoints.

## Prerequisites

- `10-os-hardening.md` completed.
- `17-dnsmasq.md` completed (so syslog is functional).

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

- [ ] CHECKPOINT 1 confirmed — recent sshd log entries visible via journalctl
- [ ] `pkg_install fail2ban`
- [ ] Write `/etc/fail2ban/jail.d/cortex.conf` (bantime 1h, sshd enabled on `{SSH_PORT}`)
- [ ] `sudo systemctl enable fail2ban` + `sudo systemctl restart fail2ban`
- [ ] Confirm `fail2ban-client status sshd` shows jail active
- [ ] CHECKPOINT 2 confirmed — sshd jail active with filter listed

## CHECKPOINT 1

**STOP — operator question:** `journalctl -u ssh --no-pager -n 5` shows recent SSH log entries (fail2ban reads these)?

Type `confirmed` to proceed.

## Install

```bash
pkg_install fail2ban
dpkg -s fail2ban >/dev/null
```

## Configure

Write `/etc/fail2ban/jail.d/cortex.conf`:

```bash
sudo tee /etc/fail2ban/jail.d/cortex.conf <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
port    = {SSH_PORT}
EOF
```

Replace `{SSH_PORT}` with your SSH port (default `22`).

```bash
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

## Verify

```bash
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

Expected: `sshd` jail is active, filter listed.

## CHECKPOINT 2

**STOP — operator question:** Does `sudo fail2ban-client status sshd` print `Currently failed:` and `Currently banned:` lines (jail active, not `Sorry but the jail 'sshd' does not exist`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/20-prometheus.md`
