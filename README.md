# CortexOS

Self-hosted AI infrastructure and agent orchestration system. Replicates a complete development environment on Ubuntu with AI CLI tools, database stack, monitoring, and automation.

## What It Does

- **AI Gateway**: 9Router for unified access to Claude, GPT, Gemini, and open-source models
- **Databases**: PostgreSQL, MySQL, MongoDB, Redis
- **Monitoring**: Prometheus, Grafana, Loki, Fluent Bit
- **CLI Tools**: Claude Code, Qwen Code, tmux, zsh
- **Reverse Proxy**: Caddy with automatic TLS
- **VPN**: Tailscale for secure access

## Quick Start

### 1. Clone This Repo
```bash
git clone https://github.com/cortexos/cortexos.git /opt/cortexos
cd /opt/cortexos
```

### 2. Run Setup
```bash
# Interactive setup
bash docs/config-install.sh

# Or follow docs/INSTALL.md step by step
```

### 3. Configure AI Tools
```bash
# Update 9Router config for Qwen Code
/qwen-code:update-9router
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/INSTALL.md](docs/INSTALL.md) | Fresh Ubuntu server setup |
| [docs/CONFIG.md](docs/CONFIG.md) | Dotfiles: zsh, tmux, Claude Code |
| [docs/SERVICES.md](docs/SERVICES.md) | All running services |
| [docs/README.md](docs/README.md) | Full documentation index |
| [CLAUDE.md](CLAUDE.md) | AI agent instructions |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Operator Laptop                         │
│  Claude Code / Qwen Code ──► SSH ──► CortexOS Host       │
└─────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   ┌─────────┐           ┌──────────┐          ┌──────────┐
   │ Docker  │           │ Systemd  │          │   AI     │
   │ Stack   │           │ Services │          │  Gateway  │
   └─────────┘           └──────────┘          └──────────┘
   Postgres               Caddy              9Router + Ollama
   MySQL                 Tailscale
   MongoDB               Dashboard
   Redis                 Hermes
   Prometheus            Honcho
   Grafana               Mail Guardian
```

## Requirements

- Ubuntu 24.04 LTS or newer
- 4GB RAM minimum (8GB recommended)
- 50GB disk space
- SSH access

## License

MIT
