# CortexOS Incus Foundation

This stack provides the Incus container infrastructure for CortexOS.

## Components

### Base Image Provisioning
- `base-image-provision.sh` - Creates Ubuntu base image with:
  - Core utilities (curl, git, vim, jq)
  - Docker CLI
  - Node.js 22
  - pnpm
  - zsh + Oh-My-Zsh
  - tmux + TPM + plugins
  - Claude Code / Qwen Code CLI tools
  - Tailscale
  - Caddy
  - Incus client tools

### Gastown Image (Steve Yegge's CLI)
- `gastown-provision.sh` - Adds to base image:
  - Go 1.25+
  - Dolt 2.0.7+
  - beads (bd) CLI

### Configuration Files
- `tmux.conf` - Clean tmux config (see `.tmux.conf` in home dir)
- `zshrc` - Base zsh configuration
- `10-cortex-zfs.conf` - ZFS configuration

## Images Published

| Image | Description |
|-------|-------------|
| `cortexos-base` | Ubuntu with core tools |
| `cortexos-gastown` | Base + Go/Dolt/beads |

## Usage

```bash
# Build base image
./base-image-provision.sh
incus publish cortex-base-build cortexos-base --alias cortexos-base

# Build gastown image
./gastown-provision.sh
incus publish cortex-gastown-build cortexos-gastown --alias cortexos-gastown
```

## Hermes Integration

Hermes runs inside Incus project instances. Each project instance gets:
- Hermes agent with project-specific config
- Access to 9Router via proxy
- Persistent storage for sessions and memory

See `templates/hermes/` for Hermes configuration templates.
