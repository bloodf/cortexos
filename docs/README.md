# CortexOS Documentation

## Start Here

| Guide | Description |
|-------|-------------|
| [GETTING-STARTED.md](GETTING-STARTED.md) | First steps for new users |
| [GUIDE.md](GUIDE.md) | Complete overview of CortexOS |
| [GLOSSARY.md](GLOSSARY.md) | Technical terms explained |

---

## 📖 Documentation Map

```
NEW USER
    │
    ├─► GETTING-STARTED.md ──► First steps
    │
    ├─► GUIDE.md ──────────► What is CortexOS?
    │
    └─► GLOSSARY.md ───────► Technical terms

OPERATOR
    │
    ├─► INSTALL.md ─────────► Server setup
    │
    └─► CONFIG.md ──────────► Configure tools

TROUBLESHOOTING
    │
    └─► TROUBLESHOOTING.md ─► Fix problems
```

---

## All Documentation

### For Everyone
| Doc | Description |
|-----|-------------|
| [GETTING-STARTED.md](GETTING-STARTED.md) | Quick start guide |
| [GUIDE.md](GUIDE.md) | Complete overview |
| [GLOSSARY.md](GLOSSARY.md) | Terms explained |

### For Operators
| Doc | Description |
|-----|-------------|
| [INSTALL.md](INSTALL.md) | Fresh Ubuntu setup |
| [CONFIG.md](CONFIG.md) | Dotfiles & tools |
| [SERVICES.md](SERVICES.md) | All services |
| [AI-SETUP.md](AI-SETUP.md) | AI configuration |

### For Developers
| Doc | Description |
|-----|-------------|
| [TMUX-GUIDE.md](TMUX-GUIDE.md) | Terminal sessions |
| [DOCKER-GUIDE.md](DOCKER-GUIDE.md) | Docker basics |
| [CLI-TOOLS.md](CLI-TOOLS.md) | AI CLI tools |
| [APPS.md](APPS.md) | App management |

### Quick Help
| Doc | Description |
|-----|-------------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Problems & solutions |

---

## Quick Commands

### Check Everything
```bash
docker ps
systemctl status caddy tailscaled
curl -s http://localhost:11434/v1/models | jq '.data | length'
```

### Common Tasks
```bash
# Restart service
sudo systemctl restart cortex-dashboard

# View logs
journalctl -u cortex-dashboard -n 50

# Check disk/memory
df -h && free -h
```

---

## Need Help?

1. **New to CortexOS?** → [GETTING-STARTED.md](GETTING-STARTED.md)
2. **Can't connect?** → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. **Setting up?** → [INSTALL.md](INSTALL.md)
4. **Configuring?** → [CONFIG.md](CONFIG.md)
