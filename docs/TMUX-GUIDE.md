# tmux Guide for Beginners

> **What is tmux?** It's a "terminal multiplexer" - it lets you have multiple terminal sessions in one window. Think of it like browser tabs, but for terminals.

---

## Why use tmux?

| Benefit | Explanation |
|---------|-------------|
| **Never lose work** | If SSH disconnects, tmux keeps running |
| **Multiple sessions** | Run many tasks at once |
| **Split screens** | See multiple terminals side by side |
| **Sessions persist** | Close your laptop, come back later |

---

## Quick Start

### Starting tmux:

```bash
tmux new -s mysession    # Create a named session
tmux new-session          # Create unnamed session
```

### Exiting tmux (but keeping it running):

```
Ctrl+a then d             # "Detach" - leave but keep running
```

### Coming back:

```bash
tmux ls                  # List all sessions
tmux attach              # Attach to last session
tmux attach -t main      # Attach to specific session
```

---

## Essential Commands

### When inside tmux (remember: `Ctrl+a` is your prefix):

| Command | What it does |
|---------|--------------|
| `Ctrl+a d` | Detach (leave but keep running) |
| `Ctrl+a c` | Create new window |
| `Ctrl+a n` | Next window |
| `Ctrl+a p` | Previous window |
| `Ctrl+a 0-9` | Go to window number |
| `Ctrl+a ,` | Rename current window |
| `Ctrl+a $` | Rename current session |

### Splitting the screen:

| Command | What it does |
|---------|--------------|
| `Ctrl+a \|` | Split left/right |
| `Ctrl+a -` | Split top/bottom |
| `Ctrl+a o` | Switch between panes |
| `Ctrl+a x` | Close current pane |

### Copy mode (scrolling through history):

```
Ctrl+a [                    # Enter copy mode
# Then use arrow keys to scroll
q                            # Exit copy mode
```

---

## Copy & Paste in tmux

```
Ctrl+a [                    # Enter copy mode
Space                       # Start selecting
Arrow keys                # Move selection
Enter                     # Copy selected text
Ctrl+a ]                  # Paste
```

---

## Session Management

### Save and Restore Sessions (Very Important!)

Your sessions can be saved and restored - so even if the server restarts, you don't lose your work:

| Command | What it does |
|---------|--------------|
| `Ctrl+a S` | **Save** current session |
| `Ctrl+a R` | **Restore** saved session |

> This uses the `tmux-resurrect` plugin. Your sessions are saved automatically every 15 minutes.

---

## Mouse Mode

Mouse mode is **enabled** - you can:

- **Click** a window tab to switch to it
- **Click** a pane to select it
- **Scroll** with your mouse wheel to scroll history
- **Drag** pane borders to resize them

---

## Customizing tmux

### Reload configuration without restarting:

```
Ctrl+a r                    # Reload ~/.tmux.conf
```

### Check current settings:

```bash
tmux show-options -g        # Show global options
tmux list-keys             # List all key bindings
```

---

## Troubleshooting

### "tmux: command not found"

```bash
sudo apt install tmux       # Install tmux
```

### Screen looks broken

```bash
# Make sure your terminal supports 256 colors
export TERM=xterm-256color
```

### Sessions not saving

```bash
# Check if resurrect plugin is working
tmux run '~/.tmux/plugins/tmux-resurrect/scripts/save.sh'
```

---

## Tips for Beginners

1. **Start simple** - Just use `tmux new -s work` and `Ctrl+a d` to detach
2. **Learn one thing at a time** - Today: splitting screens. Tomorrow: copy mode
3. **Use named sessions** - `tmux new -s project1` is easier to find than unnamed
4. **Save your sessions** - `Ctrl+a S` before logging off
5. **Check session list** - `tmux ls` before starting a new one

---

## Common Workflow Example

```bash
# 1. Start a new session
tmux new -s daily

# 2. Split for coding and logs
Ctrl+a |         # Split left/right
Ctrl+a o         # Switch to right pane

# 3. Start your work
# ... do work ...

# 4. Need to check something else?
Ctrl+a c         # New window

# 5. Leaving for the day?
Ctrl+a S         # Save session
Ctrl+a d         # Detach

# 6. Coming back tomorrow?
tmux attach -t daily
```

---

## For More Advanced Use

See [CONFIG.md](CONFIG.md) for:
- Custom tmux plugins
- Advanced configuration
- Session automation

---

## Quick Reference Card

```
╔═══════════════════════════════════════════════╗
║  TMUX QUICK REFERENCE                        ║
╠═══════════════════════════════════════════════╣
║  Ctrl+a = Prefix (press before commands)     ║
╠═══════════════════════════════════════════════╣
║  WINDOWS & SESSIONS                         ║
║  c       - New window                        ║
║  d        - Detach (leave running)           ║
║  n/p      - Next/Previous window             ║
║  S        - Save session (plugin)            ║
║  R        - Restore session (plugin)          ║
╠═══════════════════════════════════════════════╣
║  PANES (Split screen)                       ║
║  |        - Split left/right                ║
║  -        - Split top/bottom                 ║
║  o        - Switch panes                     ║
║  x        - Close pane                       ║
╠═══════════════════════════════════════════════╣
║  OTHER                                      ║
║  r        - Reload config                   ║
║  [        - Copy mode (scroll)               ║
║  q        - Exit copy mode                   ║
╚═══════════════════════════════════════════════╝
```
