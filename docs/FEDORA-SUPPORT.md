# Fedora support

## Overview

CortexOS supports Fedora 40, 41, and 42 as first-class host operating systems alongside Ubuntu 22.04 and 24.04. OS-family routing is handled by `scripts/os-detect.sh` (emits `fedora <version>`) and `scripts/pkg.sh` (dispatches package, repo, firewall, and SELinux operations through the `dnf` / `firewalld` branch).

This document captures the divergences between Ubuntu and Fedora that operators and prompt authors must be aware of.

## Prerequisites

See [`prompts/os/10-fedora-prereqs.md`](../prompts/os/10-fedora-prereqs.md). That prompt installs `ca-certificates`, `curl`, `gnupg2`, `firewalld`, `policycoreutils-python-utils`, and `dnf-plugins-core`, enables `firewalld`, and confirms SELinux is `Enforcing`.

Run `prompts/os/00-os-selection.md` first so `CORTEX_OS_FAMILY=fedora` is exported.

## Divergences from Ubuntu

| Concern | Ubuntu | Fedora |
|---|---|---|
| Package manager | `apt-get` | `dnf` |
| Repo registration | `/etc/apt/sources.list.d/*.list` + keyring under `/etc/apt/keyrings` | `/etc/yum.repos.d/*.repo` + `rpm --import` for keys |
| Firewall | `ufw` | `firewalld` (zone-based) |
| Mandatory access control | AppArmor (advisory in CortexOS) | SELinux `Enforcing` (mandatory) |
| Default sudo user | `ubuntu` | `fedora` (cloud images) |
| Binary paths | typically `/usr/bin` | mix of `/usr/bin` and `/usr/sbin`; do not hard-code paths — use `command -v` |
| Service manager | systemd | systemd (identical) |

All distro-sensitive shell operations must go through `scripts/pkg.sh`. Never call `apt-get` or `dnf` directly from prompts or scripts.

## SELinux

Fedora boots with SELinux in `Enforcing` mode. CortexOS prompts are designed to work under enforcement; do not switch to `Permissive` as a workaround.

### Triage workflow for AVC denials

1. Reproduce the failing step.
2. Inspect recent denials:

   ```bash
   sudo journalctl _AUDIT_TYPE_NAME=AVC --since "10 min ago"
   sudo ausearch -m AVC,USER_AVC -ts recent
   ```

3. If a denial maps to a known label gap (e.g. a service writing to `/var/log/<custom>`), prefer `restorecon` and `semanage fcontext` over loosening policy:

   ```bash
   sudo semanage fcontext -a -t var_log_t '/var/log/cortex(/.*)?'
   sudo restorecon -Rv /var/log/cortex
   ```

4. If no built-in label fits, generate a targeted module from the audit log:

   ```bash
   sudo ausearch -m AVC,USER_AVC -ts recent | audit2allow -M cortex-local
   sudo semodule -i cortex-local.pp
   ```

   Review the generated `cortex-local.te` before installing. Commit reviewed `.te` modules under `templates/selinux/` so they are auditable and reproducible.

### When to ship a `.te` module

- Denial recurs across reboots after `restorecon`.
- A new CortexOS daemon binds an unusual port or writes to a non-standard path.
- A bundled stack ships a binary whose default labels do not match its actual filesystem layout.

Never ship a blanket `permissive` domain in production.

## Firewalld

Firewalld is zone-based; rules attach to a zone, and each interface belongs to exactly one zone.

### Open a port through `pkg.sh`

```bash
source scripts/pkg.sh
firewall_open 443 tcp
```

The Fedora branch runs `firewall-cmd --permanent --add-port` followed by `firewall-cmd --reload`.

### Tailscale interface

Tailscale installs `tailscale0`. Assign it to the `trusted` zone so the CortexOS substrate trusts intra-tailnet traffic without per-port rules:

```bash
sudo firewall-cmd --permanent --zone=trusted --add-interface=tailscale0
sudo firewall-cmd --reload
```

Verify:

```bash
sudo firewall-cmd --get-active-zones
```

Expected: `tailscale0` listed under `trusted`.

## Verification

```bash
bash scripts/os-detect.sh                    # → fedora <version>
source scripts/pkg.sh && pkg_install jq      # succeeds via dnf
systemctl is-active firewalld                # → active
getenforce                                   # → Enforcing
```

## Known-good Fedora installs of tools referenced in `prompts/tools/`

| Tool | Fedora install |
|---|---|
| Docker Engine + Compose plugin | `sudo dnf -y install dnf-plugins-core` → `pkg_repo_add fedora docker https://download.docker.com/linux/fedora/docker-ce.repo` → `pkg_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin` → `service_enable docker` |
| Node.js 24 LTS | NodeSource repo via `pkg_repo_add` then `pkg_install nodejs` |
| `jq` | `pkg_install jq` |
| `curl` | preinstalled; `pkg_install curl` is idempotent |
| Tailscale | `pkg_repo_add fedora tailscale https://pkgs.tailscale.com/stable/fedora/tailscale.repo` then `pkg_install tailscale` and `service_enable tailscaled` |
| PostgreSQL client | `pkg_install postgresql` |
| `firewalld` | preinstalled on cloud images; `pkg_install firewalld` is idempotent |
| `unattended-upgrades` equivalent | `pkg_install dnf-automatic` then `service_enable dnf-automatic.timer` |

If a tool referenced in `prompts/tools/` has no Fedora-known-good entry yet, treat it as a P6 follow-up and open an issue tagged `fedora-support`.
