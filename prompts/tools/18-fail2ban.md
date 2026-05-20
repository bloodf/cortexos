# fail2ban (latest)

## Purpose

Install and configure fail2ban to ban IPs with repeated SSH authentication failures.

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
- [ ] Write `/etc/fail2ban/jail.d/cortex.conf` (bantime 1h, ignoreip = loopback + Tailscale + LAN, sshd + recidive jails)
- [ ] `sudo systemctl enable --now fail2ban` (idempotent — `10-os-hardening.md` already enabled it)
- [ ] `sudo systemctl restart fail2ban`
- [ ] Confirm `fail2ban-client status sshd` shows jail active
- [ ] Confirm `fail2ban-client status recidive` shows recidive jail active
- [ ] CHECKPOINT 2 confirmed — sshd + recidive jails active with filters listed

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
bantime   = 1h
findtime  = 10m
maxretry  = 5
backend   = systemd
banaction = ufw
# Never ban our own networks: loopback, Tailscale CGNAT, RFC1918 LANs.
ignoreip  = 127.0.0.1/8 ::1 100.64.0.0/10 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16

[sshd]
enabled  = true
port     = {SSH_PORT}
maxretry = 3
bantime  = 2h

# Repeat offender escalation — anyone banned in 3 jails within 1 day
# gets a 1-week ban.
[recidive]
enabled  = true
logpath  = /var/log/fail2ban.log
maxretry = 3
findtime = 1d
bantime  = 1w

EOF
```

Replace `{SSH_PORT}` with your SSH port (default `22`).

Start and restart so the new jails load:

```bash
sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban
```

## Verify

```bash
sudo fail2ban-client status
sudo fail2ban-client status sshd
sudo fail2ban-client status recidive
```

Expected: `sshd` and `recidive` jails active with filters listed.

## CHECKPOINT 2

**STOP — operator question:** Does `sudo fail2ban-client status sshd` print `Currently failed:` and `Currently banned:` lines (jail active, not `Sorry but the jail 'sshd' does not exist`)?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** Does `sudo fail2ban-client status recidive` also print a `Status for the jail: recidive` block (recidive jail active and ready to escalate repeat offenders)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/20-prometheus.md`
