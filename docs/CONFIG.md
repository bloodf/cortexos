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

**`~/.tmux.conf`**:
```bash
# Terminal
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

# Basics
set -g history-limit 50000
set -g escape-time 10
set -g focus-events on
set -g set-clipboard on
set -g base-index 1
setw -g pane-base-index 1

# Mouse mode: click windows, select panes, scroll
set -g mouse on

# VI keys for copy mode
setw -g mode-keys vi
bind -T copy-mode-vi v send -X begin-selection
bind -T copy-mode-vi y send -X copy-selection-and-cancel

# Prefix (Ctrl-a instead of Ctrl-b)
unbind C-b
set -g prefix C-a
bind C-a send-prefix

# Reload config
bind r source-file ~/.tmux.conf \; display-message "Config reloaded!"

# Split panes (keep current directory)
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"
bind c new-window -c "#{pane_current_path}"

# Kill pane/session
bind x kill-pane
bind X kill-session

# Session management
bind N new-session
bind '$' command-prompt -p "Rename session: " "rename-session '%%'"

# Status bar
set -g status-position bottom
set -g status-interval 5
set -g status-style bg=colour235,fg=white
set -g status-left "#[bg=colour39,bold] #S #[bg=colour235] "
set -g status-right "#[fg=colour250] %H:%M | %d %b "
setw -g window-status-current-format "#[bg=colour39,bold] #I:#W "
setw -g window-status-format "#[fg=colour241] #I:#W "

# Plugins
set -g @plugin "tmux-plugins/tpm"
set -g @plugin "tmux-plugins/tmux-sensible"
set -g @plugin "tmux-plugins/tmux-resurrect"
set -g @plugin "tmux-plugins/tmux-continuum"
set -g @plugin "tmux-plugins/tmux-prefix-highlight"
set -g @plugin "b0o/tmux-autoreload"

# Plugin options
set -g @continuum-restore "on"
set -g @continuum-save-interval "15"
set -g @resurrect-capture-pane-contents "on"
set -g @resurrect-dir "~/.tmux/resurrect"
set -g @prefix_highlight_show_copy_mode "on"

# Session save/restore
set -g @resurrect-save 'S'
set -g @resurrect-restore 'R'

# TPM (must be last)
run "~/.tmux/plugins/tpm/tpm"
```

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

## AI CLI: Claude Code

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

**`~/.claude/settings.json`**:
```json
{
  "env": {
    "QWEN_CUSTOM_API_KEY_OPENAI_HTTPS_CORTEXOS_TAILFD052E_TS_NET_11434_V1_2A939D449F84": "sk-your-key"
  },
  "modelProviders": {
    "openai": [
      {
        "id": "cc/claude-opus-4-8",
        "name": "Claude Opus",
        "baseUrl": "https://cortexos.tailfd052e.ts.net:11434/v1",
        "envKey": "QWEN_CUSTOM_API_KEY_OPENAI_HTTPS_CORTEXOS_TAILFD052E_TS_NET_11434_V1_2A939D449F84"
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

**`~/.qwen/settings.json`**:
```json
{
  "env": {
    "QWEN_CUSTOM_API_KEY_OPENAI_HTTPS_CORTEXOS_TAILFD052E_TS_NET_11434_V1_2A939D449F84": "sk-65329820d6539b95-81nhax-b8ba59c6"
  },
  "modelProviders": {
    "openai": [
      {"id": "cc/claude-opus-4-8", "name": "cc/claude-opus-4-8", "baseUrl": "https://cortexos.tailfd052e.ts.net:11434/v1"},
      {"id": "cc/claude-opus-4-7", "name": "cc/claude-opus-4-7", "baseUrl": "https://cortexos.tailfd052e.ts.net:11434/v1"},
      {"id": "cc/claude-sonnet-4-6", "name": "cc/claude-sonnet-4-6", "baseUrl": "https://cortexos.tailfd052e.ts.net:11434/v1"},
      {"id": "cx/gpt-5.4", "name": "cx/gpt-5.4", "baseUrl": "https://cortexos.tailfd052e.ts.net:11434/v1"}
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
    HostName cortexos.tailfd052e.ts.net
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
