# dnsmasq (latest)

## Purpose

Install dnsmasq as a local caching DNS resolver so VPS services can resolve each other by short hostname and upstream DNS is cached.

## Prerequisites

- `10-os-hardening.md` completed.

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

- [ ] CHECKPOINT 1 confirmed — systemd-resolved is stub resolver and port 53 free
- [ ] `pkg_install dnsmasq`
- [ ] Set `DNSStubListener=no` in `/etc/systemd/resolved.conf` and restart `systemd-resolved`
- [ ] `firewall_open 53 udp` + `firewall_open 53 tcp`
- [ ] Write `/etc/dnsmasq.d/cortex.conf` (listen 127.0.0.1, upstreams 1.1.1.1 + 8.8.8.8)
- [ ] Replace `/etc/resolv.conf` with `nameserver 127.0.0.1` and `chattr +i`
- [ ] `sudo systemctl enable dnsmasq` + `sudo systemctl restart dnsmasq`
- [ ] CHECKPOINT 2 confirmed — `dig +short google.com @127.0.0.1` returns IPs

## CHECKPOINT 1

**STOP — operator question:** Does `resolvectl status | head -5` show `systemd-resolved` as the stub resolver?

Type `confirmed` to proceed.

## CHECKPOINT 1b

**STOP — operator question:** Does `ss -tlnp '( sport = :53 )'` print no output other than `systemd-resolved` (port 53 not bound by another DNS daemon)?

Type `confirmed` to proceed.

## Install

```bash
pkg_install dnsmasq
dpkg -s dnsmasq >/dev/null
```

Disable systemd-resolved stub listener to free port 53:

```bash
sudo sed -i 's/#DNSStubListener=yes/DNSStubListener=no/' /etc/systemd/resolved.conf
sudo systemctl restart systemd-resolved
```

Open the DNS port in the host firewall (UFW on Ubuntu/Debian):

```bash
firewall_open 53 udp
firewall_open 53 tcp
```

## Configure

Write `/etc/dnsmasq.d/cortex.conf`:

```bash
sudo tee /etc/dnsmasq.d/cortex.conf <<'EOF'
listen-address=127.0.0.1
bind-interfaces
no-resolv
server=1.1.1.1
server=8.8.8.8
cache-size=1000
log-queries=no
EOF
```

Point `/etc/resolv.conf` at dnsmasq:

```bash
sudo rm -f /etc/resolv.conf
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
sudo chattr +i /etc/resolv.conf
```

Enable and start:

```bash
sudo systemctl enable dnsmasq
sudo systemctl restart dnsmasq
```

## Verify

```bash
dig +short google.com @127.0.0.1
```

Expected: one or more IP addresses returned.

## CHECKPOINT 2

**STOP — operator question:** Does `dig +short google.com @127.0.0.1` print one or more IPv4 addresses (not empty output, not `connection refused`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/18-fail2ban.md`
