# Ubuntu prerequisites

## Purpose

Install the baseline packages required by every later `prompts/tools/` spoke on Ubuntu 22.04 and 24.04 hosts. This prompt only runs when `CORTEX_OS_FAMILY=ubuntu`.

## Prerequisites

- `prompts/os/00-os-selection.md` completed; `CORTEX_OS_FAMILY=ubuntu` exported.
- SSH access as a sudo-capable user (not root).

## Steps

### Step 1 — Verify family

```bash
test "$CORTEX_OS_FAMILY" = "ubuntu" || { echo "wrong family: $CORTEX_OS_FAMILY"; exit 1; }
```

### Step 2 — Refresh package index

```bash
sudo apt-get update -y
```

### Step 3 — Install baseline packages

```bash
source scripts/pkg.sh
pkg_install ca-certificates curl gnupg ufw unattended-upgrades
```

`pkg.sh` dispatches to `apt-get install --no-install-recommends` on the Ubuntu branch.

### Step 4 — Enable unattended upgrades

```bash
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Step 5 — Verify

```bash
dpkg -s ca-certificates curl gnupg ufw unattended-upgrades \
  | grep -E '^(Package|Status):'
```

Expected: every package shows `Status: install ok installed`.

## CHECKPOINT 1

Operator: confirm the following before the agent proceeds.

1. `apt-get update` exited cleanly.
2. All five packages report `install ok installed`.
3. `unattended-upgrades` is enabled (`systemctl is-enabled unattended-upgrades` returns `enabled`).
4. `ufw` is installed (rules are configured later in `prompts/tools/10-os-hardening.md`).

Type "confirmed" to proceed.

## Next

→ `prompts/tools/10-os-hardening.md`
