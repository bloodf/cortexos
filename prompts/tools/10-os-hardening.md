# OS Hardening (latest)

## Purpose

Apply baseline security hardening to the VPS: disable root SSH login, configure unattended-upgrades, set kernel parameters, and restrict default services. Supports Ubuntu (24.04, 25.x) and Debian 13.

## Prerequisites

- SSH access as a sudo-capable user (not root).
- `prompts/tools/00-preflight.md` completed successfully.

## Distro selection

Source distro dispatcher and confirm OS family was selected in `prompts/os/00-os-selection.md`:

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

- [ ] CHECKPOINT 1 confirmed — connected as non-root sudo user, sshd_config not managed by Ansible
- [ ] `pkg_install unattended-upgrades ufw fail2ban auditd apparmor apparmor-utils libpam-tmpdir needrestart`
- [ ] Write `/etc/ssh/sshd_config.d/99-cortex.conf` (PermitRootLogin no, PasswordAuthentication no, modern ciphers, AllowUsers cortexos)
- [ ] `sudo systemctl reload sshd`
- [ ] Enable `unattended-upgrades` (auto security patches)
- [ ] UFW: default deny incoming, allow only loopback + Tailscale (`tailscale0`) + Tailscale CGNAT (`100.64.0.0/10`) + RFC1918 LAN ranges
- [ ] Lock SSH (`{SSH_PORT}/tcp`) to Tailscale + LAN only — no public ingress
- [ ] Write `/etc/sysctl.d/99-cortex.conf` (full network + kernel hardening) and run `sudo sysctl --system`
- [ ] Enable and start `auditd` + `apparmor`
- [ ] Enable + start `fail2ban` so the sshd jail runs from spoke 10 onward (full jail map lives in `18-fail2ban.md`)
- [ ] Confirm `sudo sshd -t` prints `sshd config OK`
- [ ] CHECKPOINT 2 confirmed — `sshd -t` OK, UFW active and tailnet-locked, fail2ban active, auditd running, syncookies=1

## CHECKPOINT 1

**STOP — operator question:** You are connected as a non-root sudo user and that `/etc/ssh/sshd_config` is not managed by another tool (e.g. Ansible)?

Type `confirmed` to proceed.

## Install

```bash
pkg_install unattended-upgrades ufw fail2ban auditd apparmor apparmor-utils libpam-tmpdir needrestart
```

Verify package install:

```bash
dpkg -s ufw fail2ban auditd apparmor >/dev/null
```

## Configure

### SSH hardening (`/etc/ssh/sshd_config.d/99-cortex.conf`)

```bash
sudo tee /etc/ssh/sshd_config.d/99-cortex.conf <<'EOF'
# Identity / login policy
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
UsePAM yes
AllowUsers cortexos

# Forwarding / agent
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitTunnel no
GatewayPorts no

# Session hygiene
MaxAuthTries 3
MaxSessions 4
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2
TCPKeepAlive no
Compression no
PrintLastLog yes

# Crypto policy — modern only
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,sntrup761x25519-sha512@openssh.com
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
PubkeyAcceptedAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
EOF
sudo sshd -t
sudo systemctl reload sshd
```

> If `cortexos` is not your sudo user, replace the `AllowUsers` value
> before reloading sshd or you will lock yourself out.

### Unattended upgrades

```bash
sudo dpkg-reconfigure -plow unattended-upgrades
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
```

### Firewall — tailnet + LAN only

CortexOS exposes **zero** services to the public internet. UFW
default-denies inbound and only allows traffic from:

- `lo` (loopback)
- `tailscale0` (Tailscale virtual interface)
- `100.64.0.0/10` (Tailscale CGNAT block)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC1918 LAN)

```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw default deny routed

# Loopback always allowed
sudo ufw allow in on lo

# Tailscale interface — all traffic from the tailnet trusted
sudo ufw allow in on tailscale0
sudo ufw allow from 100.64.0.0/10

# RFC1918 LANs
sudo ufw allow from 10.0.0.0/8
sudo ufw allow from 172.16.0.0/12
sudo ufw allow from 192.168.0.0/16

# SSH only from the trusted networks above (Tailscale + LAN).
# Do NOT open {SSH_PORT} to 0.0.0.0/0 — the per-source `allow from` rules
# above already cover SSH because UFW is stateful.
sudo ufw limit in on tailscale0 to any port {SSH_PORT} proto tcp

# Explicitly drop all public 80/443. Caddy is reachable only over Tailscale.
sudo ufw deny in on $(ip -o route get 1.1.1.1 | awk '{print $5; exit}') to any port 80 proto tcp
sudo ufw deny in on $(ip -o route get 1.1.1.1 | awk '{print $5; exit}') to any port 443 proto tcp

sudo ufw logging medium
sudo ufw --force enable
sudo ufw status verbose
```

Replace `{SSH_PORT}` with your SSH port (default `22`).

### Kernel + network hardening (`/etc/sysctl.d/99-cortex.conf`)

```bash
sudo tee /etc/sysctl.d/99-cortex.conf <<'EOF'
# Reverse-path + SYN protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1

# Drop spoofed / source-routed / redirect traffic
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Log Martians
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# ICMP hardening
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1

# Disable IP forwarding (this is a host, not a router)
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# Kernel hardening
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
kernel.yama.ptrace_scope = 2
kernel.randomize_va_space = 2
kernel.unprivileged_userns_clone = 0
kernel.perf_event_paranoid = 3

# Filesystem hardening
fs.suid_dumpable = 0
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.protected_fifos = 2
fs.protected_regular = 2

# Keep IPv6 enabled (Tailscale uses it)
net.ipv6.conf.all.disable_ipv6 = 0
EOF
sudo sysctl --system
```

### AppArmor + auditd + fail2ban activation

```bash
sudo systemctl enable --now apparmor
sudo systemctl enable --now auditd
sudo systemctl enable --now fail2ban
```

A full set of fail2ban jails (sshd, recidive, caddy auth) lands in
`prompts/tools/18-fail2ban.md`. This spoke only guarantees the
service is **running** from the start so the sshd jail begins
collecting evidence the moment SSH is reachable.

## Verify

```bash
sudo sshd -t && echo "sshd config OK"
sudo ufw status verbose
sysctl net.ipv4.tcp_syncookies kernel.kptr_restrict kernel.yama.ptrace_scope
systemctl is-active apparmor auditd fail2ban
sudo fail2ban-client status sshd | head -5
```

Expected:

- `sshd config OK`
- UFW status `Status: active` with `tailscale0` allow rule and explicit
  public 80/443 deny rules; no `Anywhere` allow for SSH.
- `tcp_syncookies = 1`, `kptr_restrict = 2`, `yama.ptrace_scope = 2`.
- `apparmor`, `auditd`, `fail2ban` all `active`.
- fail2ban `sshd` jail prints `Status for the jail: sshd` (not `does not exist`).

## CHECKPOINT 2

**STOP — operator question:** Does `sudo ufw status verbose` show `Status: active` with `tailscale0` and `100.64.0.0/10` allow rules AND no `Anywhere` allow on `{SSH_PORT}` (i.e. SSH is reachable only via Tailscale / LAN, not from `0.0.0.0/0`)?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** Does `systemctl is-active apparmor auditd fail2ban` print `active` three times AND `sudo fail2ban-client status sshd` print a `Status for the jail: sshd` block (not `does not exist`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/11-docker.md`
