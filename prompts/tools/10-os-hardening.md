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

## CHECKPOINT 1

Operator: confirm you are connected as a non-root sudo user and that `/etc/ssh/sshd_config` is not managed by another tool (e.g. Ansible). Type "confirmed" to proceed.

## Install

```bash
pkg_install unattended-upgrades ufw fail2ban
```

Verify package install:

```bash
dpkg -s ufw >/dev/null
```

## Configure

### SSH hardening (`/etc/ssh/sshd_config.d/99-cortex.conf`)

```bash
sudo tee /etc/ssh/sshd_config.d/99-cortex.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowTcpForwarding no
MaxAuthTries 3
LoginGraceTime 30
EOF
sudo systemctl reload sshd
```

### Unattended upgrades

```bash
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Firewall baseline rules

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
firewall_open {SSH_PORT} tcp
sudo ufw --force enable
```

Replace `{SSH_PORT}` with your SSH port (default `22`).

### Kernel hardening (`/etc/sysctl.d/99-cortex.conf`)

```bash
sudo tee /etc/sysctl.d/99-cortex.conf <<'EOF'
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.tcp_syncookies = 1
net.ipv6.conf.all.disable_ipv6 = 0
kernel.dmesg_restrict = 1
fs.suid_dumpable = 0
EOF
sudo sysctl --system
```

## Verify

```bash
sudo sshd -t && echo "sshd config OK"
sudo ufw status verbose
sysctl net.ipv4.tcp_syncookies
```

Expected: `sshd config OK`, UFW status shows `Status: active`, syncookies = 1.

## CHECKPOINT 2

Operator: confirm SSH is still accessible, UFW shows the expected rules, and `sshd -t` returned OK. Type "confirmed" to proceed.

## Next

→ `prompts/tools/11-docker.md`
