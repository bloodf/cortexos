# Ubuntu prerequisites

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

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

# 4d. CRITICAL — re-emit PATH + env from the prior bash environment.
# oh-my-zsh installs a stock ~/.zshrc that does NOT source ~/.profile,
# ~/.bashrc, /etc/profile.d/*, or Linuxbrew/nvm/cargo env. Without the
# block below, switching login shell to zsh "loses" every tool the
# operator installed under bash (brew, node via nvm, cargo, pyenv, etc.).
# We append an idempotent guard block at the end of ~/.zshrc so future
# spokes (Linuxbrew, Node, etc.) that write to ~/.profile or
# /etc/profile.d/ are automatically picked up by zsh on next login.
if ! grep -q '# >>> cortexos env bridge >>>' "$HOME/.zshrc"; then
  cat >> "$HOME/.zshrc" <<'ZRC'

# >>> cortexos env bridge >>>
# Re-emit the same PATH + env that bash login shells get. Keeps zsh in
# sync with anything later spokes drop into /etc/profile.d/ or ~/.profile.
[ -r /etc/profile ]        && emulate sh -c '. /etc/profile'
for f in /etc/profile.d/*.sh; do [ -r "$f" ] && emulate sh -c ". $f"; done
[ -r "$HOME/.profile" ]    && emulate sh -c '. "$HOME/.profile"'
# Linuxbrew (installed by a later spoke) — picked up automatically once present.
if [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi
# nvm (if a later spoke installs it under ~/.nvm).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
# cargo (if a later spoke installs rustup).
[ -r "$HOME/.cargo/env" ]  && . "$HOME/.cargo/env"
# <<< cortexos env bridge <<<
ZRC
fi

# 4e. Make zsh the login shell for the current operator user.
sudo chsh -s "$(command -v zsh)" "$USER"
```

> **Note.** `chsh` does not affect the current SSH session — log out and back in (or `exec zsh -l`) to see the new shell. The CortexOS bootstrap dispatch (`ssh '<cmd>'`) explicitly runs commands under `bash -c` regardless of the login shell, so spoke execution is unaffected.
>
> **Why the env bridge in 4d matters.** Without it, switching login shell to zsh strips Linuxbrew / nvm / cargo / any `/etc/profile.d/` exports from interactive sessions — the operator opens a new SSH window and `brew`, `node`, `npm`, `cargo` all report `command not found` even though the binaries are still on disk. The bridge re-sources every bash-style env file on zsh startup and is idempotent (guard-grep skips re-append on re-run).

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
grep -q '# >>> cortexos env bridge >>>' "$HOME/.zshrc" && echo "env bridge: installed"
getent passwd "$USER" | awk -F: '{print "login shell: "$NF}'

# Smoke-check that the env bridge re-emits PATH under zsh — should print the
# same set of bin dirs you see under bash. If brew/node/cargo were installed
# before this spoke ran, they MUST appear here.
zsh -l -c 'echo "PATH under zsh: $PATH"'
```

Expected: every apt package shows `Status: install ok installed`, both oh-my-zsh markers print `installed`, and the login shell is `/usr/bin/zsh` (or `/bin/zsh`).

## CHECKPOINT 1

**STOP — operator question:** Did every apt package in Step 3+4 print `Status: install ok installed` (zero `not installed`, zero apt errors)?

Type `confirmed` to proceed.

## CHECKPOINT 2

**STOP — operator question:** Did `test -d ~/.oh-my-zsh && echo ok` print `ok`, and do both `zsh-autosuggestions` + `zsh-syntax-highlighting` directories exist under `~/.oh-my-zsh/custom/plugins/`?

Type `confirmed` to proceed.

## CHECKPOINT 2b

**STOP — operator question:** Did `grep -q '# >>> cortexos env bridge >>>' ~/.zshrc && echo ok` print `ok`, AND does `zsh -l -c 'echo $PATH'` include the same `/usr/local/bin` + Linuxbrew + nvm dirs you see under `bash -l -c 'echo $PATH'` (i.e. zsh did NOT drop tools the operator already had)?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** Does `getent passwd "$USER" | awk -F: '{print $NF}'` print a path ending in `zsh` (e.g. `/usr/bin/zsh`)?

Type `confirmed` to proceed.

## CHECKPOINT 4

**STOP — operator question:** Does `systemctl is-enabled unattended-upgrades` print `enabled`?

## Next

→ `prompts/tools/10-os-hardening.md`
