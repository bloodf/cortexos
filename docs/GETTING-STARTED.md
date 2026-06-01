# Getting Started with CortexOS

> **Welcome!** This guide will help you understand what CortexOS is and how to use it - no technical experience required.

---

## What is CortexOS?

CortexOS is a **self-hosted AI infrastructure** - think of it as your own private AI computer in the cloud. Instead of relying on external services, everything runs on your own server.

### What can it do?

| Feature | What it means for you |
|---------|----------------------|
| **AI Models** | Access Claude, GPT, Gemini, and more through one gateway |
| **Databases** | Store data (like MySQL, PostgreSQL) for your applications |
| **Monitoring** | Watch your server's health (CPU, memory, disk) |
| **AI Agents** | Automated assistants (Hermes) that can help with tasks |
| **Dashboard** | Web interface to control everything |

---

## Connecting to Your Server

### What you need:
1. **SSH key** - Your digital key to access the server
2. **Terminal** - A program to type commands (like Terminal on Mac, or PowerShell on Windows)

### Quick Connect:

```bash
ssh cortexos@cortexos.tailfd052e.ts.net
```

> If this doesn't work, ask your team lead for access credentials.

---

## Basic Terminology

| Term | Simple Explanation |
|------|-------------------|
| **SSH** | Secure way to connect to another computer remotely |
| **Terminal** | Text-based interface to run commands |
| **tmux** | Tool to have multiple terminal windows in one |
| **Docker** | Container system to run services isolated |
| **9Router** | Gateway that routes AI requests to different models |
| **Hermes** | AI agent that can help with development tasks |

---

## Quick Reference Commands

### Finding your way around:

```bash
ls              # List files in current folder
cd folder      # Go into a folder
pwd             # Show current folder path
```

### Docker (services):

```bash
docker ps              # See running services
docker ps --format "table {{.Names}}\t{{.Status}}"   # Pretty view
```

### Checking services:

```bash
systemctl status caddy          # Check if web server is running
curl -s http://localhost:3000   # Test if dashboard responds
```

### AI Gateway (9Router):

```bash
curl -s http://localhost:11434/v1/models | jq '.data[].id'  # List available AI models
```

---

## Common Tasks

### How do I check if everything is working?

```bash
# Check all CortexOS services
docker ps --format "table {{.Names}}\t{{.Status}}" | grep cortex

# Check system services
systemctl status caddy tailscaled
```

### How do I restart a service?

```bash
sudo systemctl restart cortex-dashboard
sudo systemctl restart docker
```

### How do I see logs?

```bash
# View recent logs
journalctl -u cortex-dashboard -n 50

# Follow logs in real-time
journalctl -u cortex-dashboard -f
```

---

## Getting Help

| Resource | When to use |
|----------|-------------|
| [INSTALL.md](INSTALL.md) | Setting up a new server |
| [CONFIG.md](CONFIG.md) | Configuring your tools |
| [SERVICES.md](SERVICES.md) | Understanding what services exist |
| Team Chat | Questions about your specific setup |

---

## For Developers

If you're a developer working with CortexOS:

1. **Read [INSTALL.md](INSTALL.md)** for server setup
2. **Read [CONFIG.md](CONFIG.md)** for development environment
3. **Check [SERVICES.md](SERVICES.md)** to understand the architecture

---

## Keyboard Shortcuts (tmux)

Since you'll likely use tmux, here are the basics:

| Shortcut | Action |
|----------|--------|
| `Ctrl+a` then `c` | New window |
| `Ctrl+a` then `d` | Detach (leave tmux but keep it running) |
| `Ctrl+a` then `|` | Split left/right |
| `Ctrl+a` then `-` | Split top/bottom |
| `Ctrl+a` then `r` | Reload config |
| `Ctrl+a` then `S` | Save session |
| `Ctrl+a` then `R` | Restore session |

---

## Next Steps

1. ✅ You understand what CortexOS is
2. ✅ You can connect to the server
3. ✅ You know basic commands

**Ready to learn more?**
- [INSTALL.md](INSTALL.md) - Set up your own server
- [SERVICES.md](SERVICES.md) - Learn about all available services
- [CONFIG.md](CONFIG.md) - Set up your development tools
