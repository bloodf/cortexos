# CortexOS Dotfiles Configuration

This document describes the dotfile configurations for replicating the CortexOS development environment.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/cortexos/cortexos/main/docs/config-install.sh | bash
```

Or manually install each component below.

---

## Shell: Zsh + Oh-My-Zsh

### Installation

```bash
# Install Oh-My-Zsh
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# Install plugins
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-completions
```

### Configuration

**`~/.zshrc`** (core settings):
```zsh
# Theme
ZSH_THEME="robbyrussell"

# Plugins
plugins=(git docker docker-compose systemd ufw zsh-autosuggestions zsh-syntax-highlighting zsh-completions)

# Load Oh-My-Zsh
source $ZSH/oh-my-zsh.sh

# Environment
export EDITOR='vim'
export VISUAL='vim'

# Path
typeset -U path PATH
path=(
  ~/.local/bin
  ~/bin
  /usr/local/bin
  $path
)
```

### Key Aliases (add to `~/.zshrc`)

```zsh
# Git
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline -10'
alias gd='git diff'

# Docker
alias d='docker'
alias dc='docker compose'
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}"'

# System
alias c='caddy'
alias h='hermes'
alias t='tmux'

# Quick navigation
alias ll='ls -lah'
alias ..='cd ..'
alias ...='cd ../..'
```

---

## Terminal Multiplexer: tmux

### Installation

```bash
# Install tmux plugin manager
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
```

### Configuration

**`~/.tmux.conf`** — the canonical config lives in [`prompts/tools/09-tmux.md`](../prompts/tools/09-tmux.md) (single source of truth; the block there is byte-identical to the deployed `~/.tmux.conf`). Highlights:

```bash
# Terminal capability — true color + extended keys over SSH
set -g default-terminal "tmux-256color"
set -ga terminal-overrides ",xterm-256color:RGB"
set -ga terminal-features    ",xterm-256color:extkeys"
set -g extended-keys on

# Mouse: drag copies on release and KEEPS the highlight,
# double-click = word, triple-click = line, click = clear.
set -g mouse on
bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-selection-no-clear
bind -T copy-mode-vi MouseDown1Pane send-keys -X cancel

# Clipboard over plain SSH (OSC52, no xclip/X11)
set -g set-clipboard on
set -g allow-passthrough on
set -as terminal-features ',*:clipboard'

# Prefix Ctrl-a, vi copy mode, | / - splits keeping cwd,
# resurrect (S/R) + continuum autosave every 15 min, powerline status.
```

See the full config in `prompts/tools/09-tmux.md` § "Create tmux configuration".

### tmux Key Bindings

| Binding | Action |
|---------|--------|
| `prefix + r` | Reload config |
| `prefix + \|` | Split horizontal |
| `prefix + -` | Split vertical |
| `prefix + c` | New window |
| `prefix + N` | New session |
| `prefix + $` | Rename session |
| `prefix + x` | Kill pane |
| `prefix + S` | Save session |
| `prefix + R` | Restore session |

### tmux Commands

```bash
tmux new -s main        # Create session
tmux ls                # List sessions
tmux attach            # Attach to last session
tmux attach -t main    # Attach to specific session
tmux kill-server       # Kill all sessions
tmux kill-session -t main  # Kill specific session
```

---

## CLI Tool: fzf

A 3 MB Go binary that adds `Ctrl+R` history search, `Ctrl+T` file picking, and `Alt+C` directory jumping to bash and zsh. Installed by `prompts/tools/30b-fzf.md` on the host and every Incus instance.

### Installation

```bash
sudo apt-get install -y fzf
```

The package ships:

- `/usr/bin/fzf` — the binary
- `/usr/share/doc/fzf/examples/key-bindings.{bash,zsh}` — `Ctrl+R` / `Ctrl+T` / `Alt+C` keybindings
- `/usr/share/doc/fzf/examples/completion.{bash,zsh}` — `**<Tab>` file-path completion
- `/etc/profile.d/fzf.sh` — auto-sources the bash scripts in interactive shells

### Configuration

**`/etc/profile.d/fzf.sh`** (host bash — already installed by the package):

```bash
# fzf shell integration — bash key-bindings + completion
if [ -r /usr/share/doc/fzf/examples/key-bindings.bash ]; then
  source /usr/share/doc/fzf/examples/key-bindings.bash
fi
if [ -r /usr/share/doc/fzf/examples/completion.bash ]; then
  source /usr/share/doc/fzf/examples/completion.bash
fi
```

**`~/.zshrc`** — add fzf to the oh-my-zsh plugin list (host):

```zsh
plugins=(... fzf ...)
```

**`~/.zshrc`** — manual drop-in (Incus instances, no oh-my-zsh):

```zsh
if [ -r /usr/share/doc/fzf/examples/key-bindings.zsh ]; then
  source /usr/share/doc/fzf/examples/key-bindings.zsh
fi
if [ -r /usr/share/doc/fzf/examples/completion.zsh ]; then
  source /usr/share/doc/fzf/examples/completion.zsh
fi
```

### Key Bindings

| Trigger | Action |
|---------|--------|
| `Ctrl+R` | Fuzzy search command history |
| `Ctrl+T` | Fuzzy pick a file, paste its path |
| `Alt+C`  | Fuzzy `cd` into a directory |
| `**` + `Tab` | File-path completion (`ssh **<Tab>`) |

### Useful Aliases

```bash
# fzf helpers
alias fcd='fzf --preview "ls -la {}" | xargs -r cd'
alias fkill='ps -ef | fzf | awk "{print \$2}" | xargs -r kill'
alias fbr='git branch --all | fzf | xargs -r git checkout'
```

### Related

The dashboard's terminal page exposes `fzf` as a "Quick command" (see `packages/dashboard/src/lib/server/terminal/pty-bridge.ts` `term.fzf` op). The Terminal page is the place to drive interactive `fzf` runs that need a proper PTY.

---

## AI CLI: Claude Code

> **CortexOS routing policy:** all AI CLIs and agents use the local 9Router gateway as their provider, except Kimi tooling which may target Kimi directly. Claude Code is additionally restricted to Claude-only models.

### Installation

```bash
npm install -g @anthropic-ai/claude-code
```

### Configuration Files

**`~/.claude/CLAUDE.md`**:
```markdown
<!-- OMC:START -->
# oh-my-claudecode - Multi-Agent Orchestration

<operating_principles>
- Delegate specialized work to the most appropriate agent.
- Verify outcomes before final claims.
- Choose the lightest-weight path.
</operating_principles>

<delegation_rules>
Delegate for: multi-file changes, refactors, debugging, reviews.
Work directly for: trivial ops, small clarifications.
</delegation_rules>

<model_routing>
`haiku` - quick lookups
`sonnet` - standard work
`opus` - architecture, deep analysis
</model_routing>
<!-- OMC:END -->
```

**`~/.claude/settings.json`** (Claude models only, routed through 9Router):
```json
{
  "env": {
    "OPENAI_API_KEY": "${NINEROUTER_API_KEY}"
  },
  "modelProviders": {
    "openai": [
      {
        "id": "cc/claude-opus-4-8",
        "name": "Claude Opus 4.8",
        "baseUrl": "http://127.0.0.1:11434/v1",
        "envKey": "OPENAI_API_KEY"
      },
      {
        "id": "cc/claude-opus-4-6",
        "name": "Claude Opus 4.6",
        "baseUrl": "http://127.0.0.1:11434/v1",
        "envKey": "OPENAI_API_KEY"
      },
      {
        "id": "cc/claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6",
        "baseUrl": "http://127.0.0.1:11434/v1",
        "envKey": "OPENAI_API_KEY"
      }
    ]
  },
  "model": {
    "name": "cc/claude-opus-4-8"
  }
}
```

### Useful Aliases

```bash
alias cc='claude'
alias ccc='claude --print'
alias ccs='claude --session'
```

---

## AI CLI: Qwen Code (9Router)

### Configuration

**`~/.qwen/settings.json`** (all models route through 9Router):
```json
{
  "env": {
    "QWEN_NINEROUTER_KEY": "${NINEROUTER_API_KEY}"
  },
  "modelProviders": {
    "openai": [
      {"id": "cc/claude-opus-4-8", "name": "cc/claude-opus-4-8", "baseUrl": "http://127.0.0.1:11434/v1", "envKey": "QWEN_NINEROUTER_KEY"},
      {"id": "cc/claude-opus-4-6", "name": "cc/claude-opus-4-6", "baseUrl": "http://127.0.0.1:11434/v1", "envKey": "QWEN_NINEROUTER_KEY"},
      {"id": "cc/claude-sonnet-4-6", "name": "cc/claude-sonnet-4-6", "baseUrl": "http://127.0.0.1:11434/v1", "envKey": "QWEN_NINEROUTER_KEY"},
      {"id": "cx/gpt-5.4", "name": "cx/gpt-5.4", "baseUrl": "http://127.0.0.1:11434/v1", "envKey": "QWEN_NINEROUTER_KEY"}
    ]
  },
  "model": {"name": "cc/claude-opus-4-8"}
}
```

---

## Profile: `.profile`

**`~/.profile`**:
```bash
# Editor
export EDITOR=vim
export VISUAL=vim

# Locale
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# XDG
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"

# Development paths
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

# Node
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Cargo
export CARGO_HOME="$HOME/.cargo"
export RUSTUP_HOME="$HOME/.rustup"
[ -f "$CARGO_HOME/env" ] && . "$CARGO_HOME/env"

# Go
export GOPATH="$HOME/go"
export PATH="$GOPATH/bin:$PATH"

# Bun
export BUN_INSTALL="$HOME/.bun"
[ -s "$BUN_INSTALL/_bun" ] && . "$BUN_INSTALL/bun.sh"

# PNPM
export PNPM_HOME="$HOME/.pnpm"
[ -s "$PNPM_HOME/pnpm" ] && export PATH="$PNPM_HOME:$PATH"

# Docker
export DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}"
```

---

## Shell Integration

### SSH Config (`~/.ssh/config`)

```ssh-config
Host cortexos
    HostName cortexos.<your-tailnet>.ts.net
    User cortexos
    ForwardAgent yes
    AddKeysToAgent yes
    IdentityFile ~/.ssh/id_ed25519

Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

### Git Config (`~/.gitconfig`)

```ini
[user]
    name = Heitor Ramon Ribeiro
    email = heitor.ramon@gmail.com

[alias]
    st = status
    co = checkout
    br = branch
    lg = log --oneline --graph --decorate
    unstage = reset HEAD --
    last = log -1 HEAD

[pull]
    rebase = false

[push]
    default = simple
```

---

## Complete Setup Script

See `docs/config-install.sh` for an automated installation script that sets up all components.
