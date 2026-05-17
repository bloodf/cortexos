# fail2ban (latest)

## Purpose

Install and configure fail2ban to ban IPs with repeated SSH authentication failures and protect Caddy-proxied HTTP endpoints.

## Prerequisites

- `10-os-hardening.md` completed.
- `17-dnsmasq.md` completed (so syslog is functional).

## CHECKPOINT 1

Operator: confirm `journalctl -u ssh --no-pager -n 5` shows recent SSH log entries (fail2ban reads these). Type "confirmed" to proceed.

## Install

```bash
sudo apt-get install -y fail2ban
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

Operator: confirm `fail2ban-client status sshd` shows the jail as active with 0 or more banned IPs. Type "confirmed" to proceed.

## Next

→ `prompts/tools/20-prometheus.md`
