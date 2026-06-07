# tmux Guide

> **tmux = Terminal Multiplexer** - Run multiple terminal sessions in one window.

---

## Why tmux?

| Benefit | Explanation |
|---------|-------------|
| **Never lose work** | Sessions survive SSH disconnect |
| **Multiple sessions** | Run many tasks simultaneously |
| **Split screen** | See multiple terminals side-by-side |
| **Persistence** | Close laptop, come back later |

---

## Quick Start

### Start a new session

```bash
tmux new -s mysession
```

### Detach (leave running)

Press: `Ctrl+a` then `d`

### Come back later

```bash
tmux attach -t mysession
```

---

## Essential Commands

### When in tmux (remember: `Ctrl+a` is prefix):

| Command | Action |
|---------|--------|
| `Ctrl+a d` | Detach (leave running) |
| `Ctrl+a c` | New window |
| `Ctrl+a n` | Next window |
| `Ctrl+a p` | Previous window |
| `Ctrl+a 0-9` | Go to window number |
| `Ctrl+a ,` | Rename window |
| `Ctrl+a $` | Rename session |

### Split Screen

| Command | Action |
|---------|--------|
| `Ctrl+a \|` | Split left/right |
| `Ctrl+a -` | Split top/bottom |
| `Ctrl+a o` | Switch panes |
| `Ctrl+a x` | Close pane |
| `Ctrl+a z` | Zoom pane (toggle) |

### Copy & Paste

**With the mouse (easiest):**

| Gesture | Action |
|---------|--------|
| Drag | Select; on release the text is copied and stays highlighted |
| Double-click | Select + copy word |
| Triple-click | Select + copy line |
| Single click | Clear selection |

The copy lands in the tmux buffer **and** your local clipboard via OSC52 — paste locally with `Cmd+V` / `Ctrl+Shift+V`, or inside tmux with `Ctrl+a ]`.

**With the keyboard:**

```
Ctrl+a [                   # Enter copy mode
v                          # Start selecting (vi keys)
Arrow keys / hjkl          # Move selection
y or Enter                 # Copy and exit copy mode
Ctrl+a ]                   # Paste
```

### Scrolling

```
Ctrl+a [                    # Enter copy mode
Arrow Up/Down             # Scroll
q                          # Exit copy mode
```

---

## Session Management

### Save & Restore (Plugin)

These save all your windows, panes, and running programs:

| Command | Action |
|---------|--------|
| `Ctrl+a S` | Save session |
| `Ctrl+a R` | Restore session |

Sessions auto-save every 15 minutes.

### Session Commands

```bash
tmux ls                    # List sessions
tmux new -s name         # Create named session
tmux attach              # Attach to last
tmux attach -t name     # Attach to specific
tmux kill-session -t name # Kill session
tmux kill-server         # Kill all
```

---

## Configuration

### Reload config without restarting

```
Ctrl+a r
```

### Your config file

```bash
~/.tmux.conf
```

### Key bindings in config

```bash
# Prefix
set -g prefix C-a
unbind C-b

# Reload
bind r source-file ~/.tmux.conf

# Split
bind | split-window -h
bind - split-window -v
```

---

## Mouse Mode

Mouse mode is **enabled**:
- Click window tab → switch
- Click pane → select
- Scroll wheel → scroll history
- Drag borders → resize

---

## Troubleshooting

### "tmux not found"
```bash
sudo apt install tmux
```

### Screen looks broken
```bash
export TERM=xterm-256color
```

### Sessions not restoring
```bash
tmux run '~/.tmux/plugins/tmux-resurrect/scripts/restore.sh'
```

---

## Workflow Example

```bash
# 1. Start session
tmux new -s project

# 2. Split for coding and logs
Ctrl+a |        # Split left/right
Ctrl+a o        # Switch to right

# 3. Do work...

# 4. Detach and go home
Ctrl+a S        # Save
Ctrl+a d        # Detach

# 5. Tomorrow
tmux attach -t project
```

---

## Quick Reference

```
╔═══════════════════════════════════════════════╗
║  TMUX QUICK REFERENCE                       ║
╠═══════════════════════════════════════════════╣
║  Ctrl+a = Prefix (press before commands)   ║
╠═══════════════════════════════════════════════╣
║  WINDOWS & SESSIONS                       ║
║  c       - New window                      ║
║  d        - Detach                        ║
║  n/p      - Next/Previous                  ║
║  S        - Save session (plugin)         ║
║  R        - Restore session (plugin)       ║
╠═══════════════════════════════════════════════╣
║  PANES (Split screen)                    ║
║  |        - Split left/right              ║
║  -        - Split top/bottom              ║
║  o        - Switch panes                   ║
║  x        - Close pane                    ║
╠═══════════════════════════════════════════════╣
║  OTHER                                   ║
║  r        - Reload config                 ║
║  [        - Copy mode (scroll)            ║
║  q        - Exit copy mode                ║
╚═══════════════════════════════════════════════╝
```

---

## Learn More

For custom configuration, see [CONFIG.md](CONFIG.md)
