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
# ===============================================================
# TMUX CONFIG - SSH session manager, clipboard + keys 100% wired
# Server-side: works over plain SSH without X11, no xclip needed.
# Tested with tmux 3.6.
# ===============================================================

# ---------- Terminal capability ----------
# Use tmux-256color when available (correct RGB, italics, true color).
# extended-keys preserves Shift+Enter / Shift-Tab / Ctrl-Arrow through SSH.
set -g default-terminal "tmux-256color"
set -ga terminal-overrides ",xterm-256color:RGB"
set -ga terminal-features    ",xterm-256color:extkeys"
set -g extended-keys on
set -g focus-events on

# ---------- Basics ----------
set -g history-limit 100000
set -g escape-time 10
set -g base-index 1
setw -g pane-base-index 1
setw -g window-status-current-format "#[fg=colour16,bg=colour39,bold] #I:#W "
setw -g window-status-format           "#[fg=colour244] #I:#W "

# ---------- Prefix ----------
unbind C-b
set -g prefix C-a
bind C-a send-prefix
bind r source-file ~/.tmux.conf \; display-message "tmux.conf reloaded"

# ---------- Panes ----------
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"
bind c new-window -c "#{pane_current_path}"
bind x kill-pane
bind X kill-session

# ---------- Mouse ----------
# Click selects, drag selects, right-click extends, wheel scrolls history.
set -g mouse on

# WheelUp in copy mode scrolls; outside copy mode enters copy mode.
bind -n WheelUpPane   if-shell -F -t= "#{mouse_any_flag}" "send-keys -M" "if-shell -F '#{pane_in_mode}' 'send-keys -M' 'copy-mode -e'"
bind -n WheelDownPane if-shell -F -t= "#{pane_in_mode}" "send-keys -M" ""

# Drag-release copies through tmux native buffer/OSC52 while KEEPING the
# selection highlighted (copy-selection clears it; -no-clear keeps it so you
# can still see what you copied and re-copy with y).
# A normal click exits copy mode so old selections clear without selecting more text.
bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-selection-no-clear
bind -T copy-mode-vi MouseDown1Pane send-keys -X cancel

# Double-click selects word, triple-click selects line (stays highlighted).
bind -T copy-mode-vi DoubleClick1Pane select-pane \; send-keys -X select-word \; send-keys -X copy-selection-no-clear
bind -T copy-mode-vi TripleClick1Pane select-pane \; send-keys -X select-line \; send-keys -X copy-selection-no-clear
bind -n DoubleClick1Pane select-pane \; copy-mode -M \; send-keys -X select-word \; send-keys -X copy-selection-no-clear
bind -n TripleClick1Pane select-pane \; copy-mode -M \; send-keys -X select-line \; send-keys -X copy-selection-no-clear

# ---------- Clipboard (OSC52) ----------
# `set-clipboard on` makes tmux accept the OSC52 paste escape from
# clients that send it (iTerm2, WezTerm, Kitty, foot, recent GNOME
# Terminal, Windows Terminal, Alacritty 0.14+).
set -g set-clipboard on
set -g allow-passthrough on
# Force the Ms (OSC52 clipboard) capability for every outer terminal —
# without this tmux only emits OSC52 when terminfo advertises it.
set -as terminal-features ',*:clipboard'

# Paste from the tmux buffer back into a pane.
# Note: pasting the LOCAL clipboard INTO tmux is the local terminal's
# job (Cmd-V in iTerm2/Terminal, Ctrl-Shift-V elsewhere) — those send
# keystrokes to the pane and don't go through tmux.
bind P paste-buffer
bind ] paste-buffer

# ---------- Copy mode: vi ----------
setw -g mode-keys vi
bind -T copy-mode-vi v      send-keys -X begin-selection
bind -T copy-mode-vi y      send-keys -X copy-selection-and-cancel
bind -T copy-mode-vi V      send-keys -X select-line
bind -T copy-mode-vi C-v    send-keys -X rectangle-toggle
bind -T copy-mode-vi H      send-keys -X select-line
bind -T copy-mode-vi L      send-keys -X select-line-end
bind -T copy-mode-vi J      send-keys -X cursor-down
bind -T copy-mode-vi K      send-keys -X cursor-up
bind -T copy-mode-vi Enter  send-keys -X copy-selection-and-cancel

# ---------- Shift+Enter and friends ----------
# tmux-256color with `extended-keys on` already passes Shift+Enter
# through to the app as ESC[13;2~, which Claude Code / aider / Codex /
# most prompts handle. We just keep the binding for safety.
bind -n S-Enter send-keys " "

# ---------- Status line ----------
set -g status-position bottom
set -g status-interval 5
set -g status-style bg=colour235,fg=white
set -g status-left  "#[bg=colour39,bold] #S #[bg=colour235] "
set -g status-right "#[fg=colour250] %H:%M | %d %b "

# ---------- Plugins (TPM) ----------
set -g @plugin "tmux-plugins/tpm"
set -g @plugin "tmux-plugins/tmux-sensible"
set -g @plugin "tmux-plugins/tmux-resurrect"
set -g @plugin "tmux-plugins/tmux-continuum"
set -g @plugin "erikw/tmux-powerline"

set -g @continuum-restore "on"
set -g @continuum-save-interval "15"
set -g @resurrect-capture-pane-contents "on"
set -g @resurrect-dir "~/.tmux/resurrect"
set -g @resurrect-save 'S'
set -g @resurrect-restore 'R'
set -g @tmux-powerline-theme "powerline.default"
set -g @tmux_powerline_left_status_length 40
set -g @tmux_powerline_right_status_length 60

# ---------- TPM bootstrap (must be last) ----------
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
| `prefix + x` | Kill pane |
| `prefix + X` | Kill session |
| `prefix + S` | Save session |
| `prefix + R` | Restore session |
| `prefix + d` | Detach (leave running) |
| `prefix + ]` / `prefix + P` | Paste tmux buffer |

### Mouse copy/paste behavior

| Gesture | Action |
|---------|--------|
| Drag | Select text; on release it is copied (tmux buffer + OSC52 clipboard) and **stays highlighted** |
| Double-click | Select + copy word |
| Triple-click | Select + copy line |
| Single click | Clear selection / exit copy mode |
| Wheel up | Enter copy mode and scroll |

Copy uses `copy-selection-no-clear` so the highlight survives the mouse release — the selection is already on the clipboard via OSC52 (`set-clipboard on` + `terminal-features ',*:clipboard'`). No xclip/X11 needed over SSH.

## Next

→ `prompts/tools/10-os-hardening.md`
