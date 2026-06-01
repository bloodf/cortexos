# CortexOS Documentation

## Quick Navigation

### Getting Started
| Doc | Description |
|-----|-------------|
| [INSTALL.md](INSTALL.md) | Fresh Ubuntu server setup from scratch |
| [CONFIG.md](CONFIG.md) | Dotfiles: zsh, tmux, Claude Code, Qwen Code |
| [SERVICES.md](SERVICES.md) | All running services with ports and configs |

### Core Documentation
| Doc | Description |
|-----|-------------|
| [../README.md](../README.md) | Project overview |
| [../CLAUDE.md](../CLAUDE.md) | AI agent instructions |
| [../SETUP.md](../SETUP.md) | Initial setup and bootstrap |

### Infrastructure
| Doc | Description |
|-----|-------------|
| [SECURITY.md](SECURITY.md) | Security model and practices |
| [SECRETS.md](SECRETS.md) | SOPS encryption for secrets |
| [BACKUP.md](BACKUP.md) | Backup strategy |

### Reference
| Doc | Description |
|-----|-------------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and solutions |

## Installation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    FRESH UBUNTU SERVER                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  docs/INSTALL.md                                           │
│  - System setup                                            │
│  - Docker + databases                                      │
│  - 9Router + Ollama                                        │
│  - Monitoring stack                                         │
│  - Caddy + Tailscale                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  docs/CONFIG.md                                           │
│  - zsh + Oh-My-Zsh                                        │
│  - tmux + plugins                                          │
│  - Claude Code + OMC                                       │
│  - Qwen Code + 9Router                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  docs/SERVICES.md                                         │
│  - Verify all services running                             │
│  - Check ports                                             │
│  - Health checks                                           │
└─────────────────────────────────────────────────────────────┘
```

## Automated Install

```bash
curl -fsSL https://raw.githubusercontent.com/cortexos/cortexos/main/docs/config-install.sh | bash
```

## Quick Verification

```bash
# Check services
docker ps | grep cortex
systemctl status caddy tailscaled

# Check AI gateway
curl -s http://127.0.0.1:11434/v1/models | jq '.data | length'

# Check ports
ss -tlnp | grep -E ":(3000|5432|3306|6379|9090|3100)"
```
