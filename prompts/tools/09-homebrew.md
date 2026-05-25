# Homebrew for Linux

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Install Homebrew for Linux as the shared package source for tools whose upstream install path is Homebrew-first. Mandatory in the native-first CortexOS install.

## Prerequisites

- `10-os-hardening.md` completed.

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — build deps present
- [ ] Install Linuxbrew under `/home/linuxbrew/.linuxbrew`
- [ ] Add Homebrew shellenv to `/etc/profile.d/homebrew.sh`
- [ ] Confirm `brew --version` works for login shells
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `command -v gcc >/dev/null && command -v git >/dev/null && echo OK` print `OK`?

Type `confirmed` to proceed.

## Install

```bash
NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
sudo tee /etc/profile.d/homebrew.sh >/dev/null <<'EOF'
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
EOF
. /etc/profile.d/homebrew.sh
brew update
brew doctor || true
```

## Verify

```bash
. /etc/profile.d/homebrew.sh
brew --version
```

## CHECKPOINT 2

**STOP — operator question:** Does `. /etc/profile.d/homebrew.sh && brew --version` print a Homebrew version (not `command not found`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/11-docker.md`
