# CLAUDE.md

> Operating instructions for AI agents working inside CortexOS.

## Project Context

CortexOS is a self-hosted AI infrastructure system. This repository contains:
- Deployment documentation and installer prompts
- Docker Compose stack for databases and monitoring
- Next.js dashboard for server control
- 9Router AI gateway configuration
- Agent orchestration templates

**Paths:**
- Host root: `/opt/cortexos`
- Secrets: `/opt/cortexos/.secrets/`
- Dashboard: `packages/dashboard/`

## Non-Negotiable Rules

### Security
- **Never commit secrets.** No API keys, tokens, passwords, or credentials.
- **SOPS+age encryption** for secrets. See `docs/SECRETS.md`.
- **Sandbox untrusted code.** Use `stacks/cortex-sandbox-runner` (gVisor).
- **Audit all operations.** Hash-chained logging for sensitive actions.

### Development
- **Ubuntu 24.04+ only.** Debian 13 also supported.
- **Use `scripts/pkg.sh`** for package management (not raw `apt-get`).
- **Test before claiming done.** Verify outcomes.
- **Update docs when behavior changes.**

## AI Tools Configuration

### 9Router API
- **Endpoint:** `https://cortexos.tailfd052e.ts.net:11434/v1`
- **API Key:** Set in `~/.qwen/settings.json`
- **Models:** Claude Opus, Claude Sonnet, GPT-5, Gemini, Kimi, MiniMax, Grok

### Update 9Router Config
```
/update-9router
```

## Common Commands

### Docker
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
docker compose -f /opt/cortexos/docker-compose.yml up -d
```

### Services
```bash
systemctl status 'cortex-*'
ss -tlnp | grep -E ":(3000|5432|3306|6379)"
```

### Development
```bash
cd /opt/cortexos/packages/dashboard
pnpm install
pnpm run build
```

## Architecture

```
Laptop (Claude Code/Qwen Code)
    │
    ▼ SSH
CortexOS Host
    ├── Docker (Postgres, MySQL, MongoDB, Redis, Prometheus, Grafana, Loki)
    ├── Systemd (Caddy, Tailscale, Ollama, Dashboard)
    ├── 9Router (AI Gateway)
    └── Hermes (Messaging Agent)
```

## Editing Guidelines

- Prompts in `prompts/` → stepwise, formal language
- Templates in `templates/` → safe to copy to servers
- Docs → include verification steps
- Tests → run before claiming completion

## Completion Checklist

- [ ] No secrets committed
- [ ] Tests pass
- [ ] Docs updated if behavior changed
- [ ] Links resolve
- [ ] Security notes added for risky changes
