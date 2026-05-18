# Fedora prerequisites

## Purpose

Install the baseline packages required by every later `prompts/tools/` spoke on Fedora 40, 41, and 42 hosts. This prompt only runs when `CORTEX_OS_FAMILY=fedora`.

## Prerequisites

- `prompts/os/00-os-selection.md` completed; `CORTEX_OS_FAMILY=fedora` exported.
- SSH access as a sudo-capable user (default cloud-init user, e.g. `fedora`).

## Steps

### Step 1 — Verify family

```bash
test "$CORTEX_OS_FAMILY" = "fedora" || { echo "wrong family: $CORTEX_OS_FAMILY"; exit 1; }
```

### Step 2 — Refresh and upgrade

```bash
sudo dnf -y upgrade --refresh
```

Reboot only if the kernel was updated and the operator approves.

### Step 3 — Install baseline packages

```bash
source scripts/pkg.sh
sudo dnf install -y dnf-plugins-core
pkg_install ca-certificates curl gnupg2 firewalld policycoreutils-python-utils
```

`dnf-plugins-core` is installed directly because later prompts use `dnf config-manager`. `pkg.sh` dispatches the remaining packages through the `dnf` branch.

### Step 4 — Enable firewalld

```bash
source scripts/pkg.sh
service_enable firewalld
sudo firewall-cmd --state
```

Expected: `running`.

### Step 5 — SELinux note

Fedora ships with SELinux in `Enforcing` mode by default. Do not switch it to `Permissive` for routine installs. If a later step appears blocked, inspect the audit log before adjusting policy:

```bash
sudo journalctl _AUDIT_TYPE_NAME=AVC --since "10 min ago"
```

Author a targeted `.te` policy module rather than disabling SELinux globally. See `docs/FEDORA-SUPPORT.md` for the triage procedure.

### Step 6 — Verify

```bash
rpm -q ca-certificates curl gnupg2 firewalld policycoreutils-python-utils dnf-plugins-core
systemctl is-active firewalld
getenforce
```

Expected: every package returns a version string, `firewalld` is `active`, `getenforce` returns `Enforcing`.

## CHECKPOINT 1

Operator: confirm the following before the agent proceeds.

1. `dnf upgrade --refresh` exited cleanly.
2. All six packages return a version string from `rpm -q`.
3. `firewalld` is active.
4. `getenforce` returns `Enforcing`.

Type "confirmed" to proceed.

## Next

→ `prompts/tools/10-os-hardening.md`
