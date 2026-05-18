# RHEL / Rocky / AlmaLinux prerequisites

## Purpose

Install the baseline packages required by every later `prompts/tools/` spoke on RHEL 9/10, Rocky Linux 9/10, and AlmaLinux 9/10 hosts. This prompt only runs when `CORTEX_OS_FAMILY=rhel`.

The three distros share the dnf branch in `scripts/pkg.sh`, but diverge on:

- **Subscription**: RHEL proper requires `subscription-manager register`; Rocky and AlmaLinux do not.
- **CodeReady Builder (CRB)** repo name: `crb` on Rocky/Alma, `codeready-builder-for-rhel-9-x86_64-rpms` on RHEL.
- **EPEL**: installed via `dnf install epel-release` on Rocky/Alma; via the upstream `epel-release-latest-9.noarch.rpm` URL on RHEL.

See `docs/RHEL-FAMILY-SUPPORT.md` for divergences from Fedora and known package gaps.

## Prerequisites

- `prompts/os/00-os-selection.md` completed; `CORTEX_OS_FAMILY=rhel` exported.
- SSH access as a sudo-capable user (default cloud-init user, e.g. `rocky`, `almalinux`, `cloud-user`, or `ec2-user`).
- RHEL only: a valid Red Hat subscription and the username/password or activation key on hand.

## Steps

### Step 1 — Verify family and subfamily

```bash
test "$CORTEX_OS_FAMILY" = "rhel" || { echo "wrong family: $CORTEX_OS_FAMILY"; exit 1; }
source scripts/pkg.sh
echo "family=$(pkg_family) version=$(pkg_version) subfamily=$(pkg_subfamily)"
```

`pkg_subfamily` echoes one of `rhel`, `rocky`, `almalinux`, `centos`. Steps 2 and 3 branch on it.

### Step 2 — Register subscription (RHEL only)

```bash
if [ "$(pkg_subfamily)" = "rhel" ]; then
  sudo subscription-manager register --username "$RHEL_USER" --password "$RHEL_PASS" --auto-attach
  sudo subscription-manager refresh
fi
```

Rocky and AlmaLinux skip this step. Use an activation key (`--activationkey=$KEY --org=$ORG`) instead of username/password for unattended installs.

### Step 3 — Enable CodeReady Builder (CRB) repo

CRB ships header packages that EPEL builds depend on. The repo name differs per subfamily.

```bash
sudo dnf install -y dnf-plugins-core
case "$(pkg_subfamily)" in
  rhel)
    sudo subscription-manager repos --enable "codeready-builder-for-rhel-9-$(uname -m)-rpms"
    ;;
  rocky|almalinux|centos)
    sudo dnf config-manager --set-enabled crb
    ;;
esac
```

### Step 4 — Install EPEL

```bash
case "$(pkg_subfamily)" in
  rhel)
    sudo dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
    ;;
  rocky|almalinux|centos)
    sudo dnf install -y epel-release
    ;;
esac
```

### Step 5 — Refresh and upgrade

```bash
sudo dnf -y upgrade --refresh
```

Reboot only if the kernel was updated and the operator approves.

### Step 6 — Install baseline packages

```bash
source scripts/pkg.sh
pkg_install ca-certificates curl gnupg2 firewalld policycoreutils-python-utils
```

### Step 7 — Enable firewalld

```bash
source scripts/pkg.sh
service_enable firewalld
sudo firewall-cmd --state
```

Expected: `running`.

### Step 8 — SELinux note

RHEL/Rocky/Alma ship SELinux in `Enforcing` mode by default. Do not switch to `Permissive` for routine installs. If a later step appears blocked, inspect the audit log before adjusting policy:

```bash
sudo journalctl _AUDIT_TYPE_NAME=AVC --since "10 min ago"
```

Author a targeted `.te` policy module rather than disabling SELinux globally. See `docs/RHEL-FAMILY-SUPPORT.md` for triage guidance.

### Step 9 — Verify

```bash
sudo dnf repolist
rpm -q ca-certificates curl gnupg2 firewalld policycoreutils-python-utils dnf-plugins-core epel-release
systemctl is-active firewalld
getenforce
```

Expected: `dnf repolist` shows `epel` and (CRB-named) repos enabled, every package returns a version string, `firewalld` is `active`, `getenforce` returns `Enforcing`.

## CHECKPOINT 1

Operator: confirm the following before the agent proceeds.

1. (RHEL only) `subscription-manager status` shows an active entitlement.
2. `dnf repolist` lists EPEL and CRB enabled.
3. `dnf upgrade --refresh` exited cleanly.
4. All baseline packages return a version string from `rpm -q`.
5. `firewalld` is active.
6. `getenforce` returns `Enforcing`.

Type "confirmed" to proceed.

## Next

→ `prompts/tools/10-os-hardening.md`
