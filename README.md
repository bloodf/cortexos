# CortexOS

> **Self-hosted AI Infrastructure** - Run your own AI agents, databases, and services on a single Ubuntu server.

---

## 🎯 What is CortexOS?

CortexOS is a **complete AI-ready server platform** that lets you:

| Feature | What it means |
|---------|---------------|
| 🤖 **AI Agents** | Run Hermes - your own AI coding assistant |
| 🧠 **AI Models** | Access Claude, GPT, Gemini via 9Router gateway |
| 💾 **Databases** | PostgreSQL, MySQL, MongoDB, Redis |
| 📊 **Monitoring** | Prometheus, Grafana, Loki |
| 🌐 **Web Dashboard** | Control everything from a browser |
| 🔒 **Secure** | Tailscale VPN, SOPS encryption |

---

## 🚀 Quick Start

### 1. Connect to Your Server

```bash
ssh cortexos@your-server.com
```

### 2. Check Status

```bash
docker ps                              # See running services
systemctl status caddy tailscaled      # Check system services
curl -s http://localhost:11434/v1/models | jq '.data | length'  # Check AI models
```

### 3. Access Services

| Service | URL |
|---------|-----|
| Dashboard | https://your-domain.com |
| Grafana | https://your-domain.com:3001 |
| PHPMyAdmin | https://your-domain.com:8082 |

---

## 📚 Documentation

### For Everyone
| Guide | Description |
|-------|-------------|
| [GUIDE.md](docs/GUIDE.md) | Complete overview of CortexOS |
| [GETTING-STARTED.md](docs/GETTING-STARTED.md) | First steps for new users |
| [GLOSSARY.md](docs/GLOSSARY.md) | Technical terms explained |

### For Operators
| Guide | Description |
|-------|-------------|
| [INSTALL.md](docs/INSTALL.md) | Set up a new server |
| [CONFIG.md](docs/CONFIG.md) | Configure your tools |
| [SERVICES.md](docs/SERVICES.md) | All services explained |

### For Developers
| Guide | Description |
|-------|-------------|
| [AI-SETUP.md](docs/AI-SETUP.md) | Configure AI models |
| [CLI-TOOLS.md](docs/CLI-TOOLS.md) | Claude Code, Qwen Code |

### Quick References
| Guide | Description |
|-------|-------------|
| [TMUX-GUIDE.md](docs/TMUX-GUIDE.md) | Terminal sessions |
| [DOCKER-GUIDE.md](docs/DOCKER-GUIDE.md) | Docker basics |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Fix problems |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        YOU                                    │
│                   (Browser / Terminal)                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      CADDY                                    │
│              (Reverse Proxy + TLS)                            │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌──────────────┐    ┌───────────────┐
│  Dashboard   │    │  Databases   │    │  AI Stack     │
│  (Next.js)   │    │              │    │              │
└───────────────┘    └──────────────┘    └───────┬───────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │   9Router    │
                                        │  (AI Gateway)│
                                        └──────┬───────┘
                                               │
              ┌───────────────┬─────────────────┼─────────────────┐
              │               │                 │                 │
              ▼               ▼                 ▼                 ▼
        ┌────────┐     ┌────────┐         ┌────────┐       ┌────────┐
        │Claude  │     │  GPT   │         │Gemini  │       │  Ollama│
        │(Remote)│     │(Remote)│         │(Remote)│       │(Local) │
        └────────┘     └────────┘         └────────┘       └────────┘
```

---

## 🔧 Tech Stack

| Category | Technology |
|----------|------------|
| OS | Ubuntu 24.04 LTS |
| Container | Docker |
| Databases | PostgreSQL, MySQL, MongoDB, Redis |
| AI Gateway | 9Router |
| AI Models | Claude, GPT, Gemini, Ollama |
| AI Agent | Hermes |
| Monitoring | Prometheus, Grafana, Loki |
| Web | Next.js |
| Proxy | Caddy |
| VPN | Tailscale |
| Terminal | tmux + zsh |

---

## 📁 Project Structure

```
cortexos/
├── docs/              # All documentation
├── prompts/          # Setup prompts for AI agents
├── packages/         # NPM packages
│   └── cortex-dashboard/  # Web dashboard
├── stacks/           # Docker Compose stacks
│   ├── cortex-incus/      # Incus container setup
│   └── honcho/           # Memory backend
├── templates/       # Config templates
│   └── hermes/      # Hermes agent templates
└── scripts/         # Automation scripts
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT
