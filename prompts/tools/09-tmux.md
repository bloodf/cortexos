# tmux Setup Prompt

## Purpose

Install and configure tmux with essential plugins for session management.

## Ask User

**Do you want to install tmux with plugins?** (yes/no)

## Prerequisites

- Ubuntu 24.04+ or Debian
- `git` installed

## Installation

### 1. Install tmux

```bash
sudo apt update
sudo apt install -y tmux
```

### 2. Install TPM (tmux Plugin Manager)

```bash
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
```

### 3. Create tmux configuration

```bash
cat > ~/.tmux.conf << 'EOF'
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

# Mouse mode
set -g mouse on

# VI keys
setw -g mode-keys vi
bind -T copy-mode-vi v send -X begin-selection
bind -T copy-mode-vi y send -X copy-selection-and-cancel

# Prefix
unbind C-b
set -g prefix C-a
bind C-a send-prefix

# Key bindings
bind r source-file ~/.tmux.conf \; display-message "Config reloaded!"
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"
bind c new-window -c "#{pane_current_path}"
bind x kill-pane
bind X kill-session
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
set -g @plugin "erikw/tmux-powerline"
set -g @plugin "leohenon/tmux-tab"

# Plugin options
set -g @continuum-restore "on"
set -g @continuum-save-interval "15"
set -g @resurrect-capture-pane-contents "on"
set -g @resurrect-dir "~/.tmux/resurrect"
set -g @prefix_highlight_show_copy_mode "on"
set -g @resurrect-save 'S'
set -g @resurrect-restore 'R'

# tmux-powerline
set -g @tmux-powerline-theme "powerline.default"

# tmux-tab
set -g @tmux_tab_left_separator " "
set -g @tmux_tab_right_separator " "

# TPM
run "~/.tmux/plugins/tpm/tpm"
EOF
```

### 4. Install fonts for tmux-powerline

```bash
# Install Nerd Fonts (recommended)
curl -fsSL https://github.com/ryanoasis/nerd-fonts/releases/latest/download/FiraCode.zip -o /tmp/fira.zip
sudo unzip -o /tmp/fira.zip -d /usr/share/fonts/
sudo fc-cache -f -v
```

## Install Plugins

After starting tmux for the first time, press:

```
prefix + I   (capital I)
```

This installs all plugins via TPM.

## Verify

```bash
tmux new -s test
# You should see status bar with session info
# Press prefix + d to detach
tmux ls  # Should show 'test' session
```

## Key Bindings Reference

| Binding | Action |
|---------|--------|
| `prefix + r` | Reload config |
| `prefix + |` | Split horizontal |
| `prefix + -` | Split vertical |
| `prefix + c` | New window |
| `prefix + N` | New session |
| `prefix + $` | Rename session |
| `prefix + x` | Kill pane |
| `prefix + S` | Save session |
| `prefix + R` | Restore session |
| `prefix + d` | Detach (leave running) |

## Next

→ `prompts/tools/10-os-hardening.md`
