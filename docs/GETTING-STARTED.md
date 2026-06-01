# Getting Started with CortexOS

> **Welcome!** This guide helps you take your first steps with CortexOS.

---

## First Time? Start Here!

### Step 1: Understand What You Have

CortexOS is a **self-hosted AI infrastructure**. You have:

| What's on Your Server | What It Does |
|----------------------|--------------|
| 💾 **Databases** | Store data (like MySQL, PostgreSQL) |
| 🤖 **AI Models** | Claude, GPT, Gemini via 9Router |
| 📊 **Monitoring** | Watch CPU, memory, disk usage |
| 🌐 **Dashboard** | Web interface to control everything |
| 🔒 **VPN** | Secure access from anywhere |

### Step 2: Connect to Your Server

```bash
ssh cortexos@your-server
```

You'll need:
- SSH key access
- Terminal (Terminal on Mac/Linux, PowerShell on Windows)

### Step 3: Check What's Running

```bash
# See all services
docker ps

# See system status
systemctl status caddy tailscaled
```

### Step 4: Access the Dashboard

Open your browser and go to:
```
https://your-domain.com
```

Login with your admin credentials.

---

## Daily Tasks

### Check System Health

```bash
# Quick status
docker ps

# Detailed system info
df -h          # Disk space
free -h         # Memory
htop            # CPU (press q to quit)
```

### Restart a Service

```bash
# Docker service
docker restart cortex-postgres

# System service
sudo systemctl restart cortex-dashboard
```

### View Logs

```bash
# Recent logs
journalctl -u cortex-dashboard -n 50

# Follow logs live
journalctl -u cortex-dashboard -f
```

---

## Understanding Terminal

### Basic Commands

| Command | What it Does |
|---------|--------------|
| `ls` | List files |
| `cd folder` | Go into folder |
| `cd ..` | Go back |
| `pwd` | Show current folder |
| `cat file` | Show file contents |
| `grep "text" file` | Find text in file |

### Navigation

```bash
cd /opt/cortexos      # Go to cortexos folder
ls                     # List files
cd ..                 # Go back one level
pwd                    # Show where you are
```

---

## Using tmux (Terminal Sessions)

tmux lets you have multiple terminal windows and keep sessions running even if you disconnect.

### Quick Start

```bash
tmux new -s work    # Start named session
```

### Essential Commands

| Shortcut | What it Does |
|----------|--------------|
| `Ctrl+a d` | Detach (leave tmux running) |
| `Ctrl+a c` | New window |
| `Ctrl+a |` | Split left/right |
| `Ctrl+a -` | Split top/bottom |
| `Ctrl+a o` | Switch panes |

### Coming Back

```bash
tmux ls              # List sessions
tmux attach          # Attach to last
tmux attach -t work  # Attach to "work" session
```

See [TMUX-GUIDE.md](TMUX-GUIDE.md) for more.

---

## Working with Docker

### See Running Containers

```bash
docker ps
```

### See All Containers (Including Stopped)

```bash
docker ps -a
```

### View Container Logs

```bash
docker logs cortex-postgres
```

### Restart a Container

```bash
docker restart cortex-postgres
```

### Stop/Start a Container

```bash
docker stop cortex-postgres
docker start cortex-postgres
```

---

## Accessing Databases

### PostgreSQL

```bash
docker exec -it cortex-postgres psql -U cortex -d cortex
```

### MySQL

```bash
docker exec -it cortex-mysql mysql -u cortex -p cortex
```

### MongoDB

```bash
docker exec -it cortex-mongodb mongosh -u cortex -p
```

---

## Getting Help

| Need Help With | Where to Look |
|---------------|---------------|
| Understanding CortexOS | [GUIDE.md](GUIDE.md) |
| Can't connect | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Setting up new server | [INSTALL.md](INSTALL.md) |
| Configuring tools | [CONFIG.md](CONFIG.md) |
| Using tmux | [TMUX-GUIDE.md](TMUX-GUIDE.md) |

---

## Common Scenarios

### "A service isn't working"

1. Check if it's running: `docker ps | grep service-name`
2. Check logs: `docker logs service-name`
3. Restart it: `docker restart service-name`

### "I disconnected and lost my work"

Always use tmux! Your sessions will be saved.

### "Need to run a command but don't know how"

Ask your team lead or check the docs.

---

## Keyboard Shortcuts Reference

### In Terminal

| Shortcut | What it Does |
|----------|--------------|
| `Ctrl+c` | Cancel current command |
| `Ctrl+z` | Pause command |
| `Ctrl+d` | Exit current shell |
| `Ctrl+l` | Clear screen |
| `Tab` | Auto-complete |
| `↑/↓` | Command history |

### In tmux (after pressing `Ctrl+a`)

| Shortcut | What it Does |
|----------|--------------|
| `d` | Detach (leave running) |
| `c` | New window |
| `n` | Next window |
| `p` | Previous window |
| `|` | Split left/right |
| `-` | Split top/bottom |
| `o` | Switch panes |
| `,` | Rename window |
| `x` | Close pane |

---

## Next Steps

1. ✅ Understand what CortexOS is
2. ✅ Connect to your server
3. ✅ Check services are running
4. ✅ Use tmux for persistent sessions

**Ready to learn more?**
- [GUIDE.md](GUIDE.md) - Deep dive into architecture
- [TMUX-GUIDE.md](TMUX-GUIDE.md) - Master tmux
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Fix problems
