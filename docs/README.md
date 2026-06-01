# CortexOS Documentation

## Quick Navigation

### 📚 For Everyone (Start Here!)
| Doc | Description |
|-----|-------------|
| [GUIDE.md](GUIDE.md) | Complete overview of CortexOS - what it is and how it works |
| [GETTING-STARTED.md](GETTING-STARTED.md) | Quick intro for new users |
| [TMUX-GUIDE.md](TMUX-GUIDE.md) | How to use tmux (terminal sessions) |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Problems and solutions |

### 🛠️ For Operators
| Doc | Description |
|-----|-------------|
| [INSTALL.md](INSTALL.md) | Set up a new CortexOS server |
| [CONFIG.md](CONFIG.md) | Configure your development environment |

### 📊 For Engineers
| Doc | Description |
|-----|-------------|
| [SERVICES.md](SERVICES.md) | All services, ports, and configurations |
| [APPS.md](APPS.md) | Application management |

---

## Documentation Map

```
NEW USER
    │
    ├─► GUIDE.md ────────────► What is CortexOS?
    │
    ├─► GETTING-STARTED.md ──► First steps
    │
    └─► TMUX-GUIDE.md ──────► Terminal sessions

OPERATOR
    │
    ├─► INSTALL.md ──────────► Server setup
    │
    └─► CONFIG.md ───────────► Dotfiles & tools

TROUBLESHOOTING
    │
    └─► TROUBLESHOOTING.md ──► Common problems
```

---

## Quick Commands

### Check Everything is Working

```bash
# Docker containers
docker ps

# System services
systemctl status 'cortex-*'

# AI gateway
curl -s http://127.0.0.1:11434/v1/models | jq '.data | length'
```

### Common Tasks

```bash
# Restart a service
sudo systemctl restart cortex-dashboard

# View logs
journalctl -u cortex-dashboard -n 50

# Check disk/memory
df -h && free -h
```

---

## Need Help?

1. **New to CortexOS?** → Start with [GUIDE.md](GUIDE.md)
2. **Can't connect?** → Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. **Need to set up?** → Follow [INSTALL.md](INSTALL.md)
4. **Configuring tools?** → See [CONFIG.md](CONFIG.md)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   YOU                            │
│         (Browser or Terminal)                    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│              COREDNS / CADDY                     │
│           (Reverse Proxy + TLS)                 │
└────────────────┬────────────────────────────────┘
                 │
       ┌─────────┼─────────┐
       │         │         │
       ▼         ▼         ▼
┌───────────┐ ┌──────┐ ┌──────────┐
│ Dashboard │ │  DBs │ │  AI Stack │
│ (Next.js)│ │      │ │          │
└───────────┘ └──────┘ └──────────┘
                          │
                          ▼
                   ┌──────────┐
                   │  9Router │
                   │(AI Gate) │
                   └────┬─────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
    ┌────────┐     ┌────────┐     ┌────────┐
    │Claude  │     │  GPT   │     │ Gemini  │
    └────────┘     └────────┘     └────────┘
```
