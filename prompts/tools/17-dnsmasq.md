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


## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed
## CHECKPOINT 1

**STOP — operator question:** `systemd-resolved` is the current stub resolver (`resolvectl status | head -5`) and port 53 is not already bound by another service?

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

**STOP — operator question:** DNS resolution works (`dig +short google.com @127.0.0.1` returns IPs)?

Type `confirmed` to proceed.
## Next

→ `prompts/tools/18-fail2ban.md`
