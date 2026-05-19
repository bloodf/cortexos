# Ubuntu prerequisites

## Purpose

Install the baseline packages required by every later `prompts/tools/` spoke on Ubuntu 24.04 / 25.x and Debian 13 hosts, then harden the operator shell (zsh + oh-my-zsh + autosuggestions / syntax-highlighting / completions). This prompt only runs when `CORTEX_OS_FAMILY` is `ubuntu` or `debian`.

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
pkg_install ca-certificates curl gnupg ufw unattended-upgrades \
  zsh git fonts-powerline
```

`pkg.sh` dispatches to `apt-get install --no-install-recommends` on the Ubuntu branch. `zsh` + `git` + `fonts-powerline` are required by the operator shell hardening in Step 4.

### Step 4 — Install zsh + oh-my-zsh + plugins for the operator user

CortexOS standardizes on zsh as the operator login shell so the AI agent driving spokes over SSH gets a predictable, low-noise prompt with completion + syntax highlighting.

```bash
# 4a. Run oh-my-zsh installer unattended so it does NOT chsh or exec a new shell.
RUNZSH=no CHSH=no KEEP_ZSHRC=yes \
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# 4b. Plugins — autosuggestions + syntax highlighting + completions.
ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions \
  "$ZSH_CUSTOM/plugins/zsh-autosuggestions" 2>/dev/null || true
git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting \
  "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting" 2>/dev/null || true
git clone --depth=1 https://github.com/zsh-users/zsh-completions \
  "$ZSH_CUSTOM/plugins/zsh-completions" 2>/dev/null || true

# 4c. Enable the plugins in ~/.zshrc (idempotent — only rewrites the plugins= line).
sed -i 's/^plugins=(.*)$/plugins=(git docker docker-compose systemd ufw zsh-autosuggestions zsh-syntax-highlighting zsh-completions)/' "$HOME/.zshrc"

# 4d. Make zsh the login shell for the current operator user.
sudo chsh -s "$(command -v zsh)" "$USER"
```

> **Note.** `chsh` does not affect the current SSH session — log out and back in (or `exec zsh -l`) to see the new shell. The CortexOS bootstrap dispatch (`ssh '<cmd>'`) explicitly runs commands under `bash -c` regardless of the login shell, so spoke execution is unaffected.

### Step 5 — Enable unattended upgrades

```bash
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Step 6 — Verify

```bash
dpkg -s ca-certificates curl gnupg ufw unattended-upgrades zsh git \
  | grep -E '^(Package|Status):'
test -d "$HOME/.oh-my-zsh" && echo "oh-my-zsh: installed"
test -d "$HOME/.oh-my-zsh/custom/plugins/zsh-autosuggestions"      && echo "autosuggestions: installed"
test -d "$HOME/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting"  && echo "syntax-highlighting: installed"
getent passwd "$USER" | awk -F: '{print "login shell: "$NF}'
```

Expected: every apt package shows `Status: install ok installed`, both oh-my-zsh markers print `installed`, and the login shell is `/usr/bin/zsh` (or `/bin/zsh`).

## CHECKPOINT 1

**STOP — operator question:** Did `apt-get update` exit cleanly, every baseline package (including `zsh` and `git`) report `install ok installed`, oh-my-zsh + autosuggestions + syntax-highlighting markers all print `installed`, the operator's login shell is now zsh, AND `systemctl is-enabled unattended-upgrades` returns `enabled`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/10-os-hardening.md`
