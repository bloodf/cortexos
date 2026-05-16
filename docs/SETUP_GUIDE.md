# CortexOS Setup Guide

> Operator-oriented guide for deploying CortexOS through checkpointed prompt modules.

## Contents

- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Execution model](#execution-model)
- [Prompt sequence](#prompt-sequence)
- [Verification](#verification)
- [FAQ](#faq)
- [Related docs](#related-docs)

## Prerequisites

| Requirement | Recommended value |
|---|---|
| OS | Ubuntu 24.04 LTS VPS |
| CPU | 4+ cores |
| Memory | 16 GB+ |
| Disk | 200 GB+ SSD |
| Access | SSH as sudo user |
| Network | Domain or Tailscale hostname |
| Tools | Git, AI coding agent, SSH client |

## Environment variables

```bash
export CORTEX_HOST=<vps-host>
export CORTEX_USER=<sudo-user>
export CORTEX_ROOT=/opt/cortexos
export CORTEX_DOMAIN=<dashboard-domain>
```

Keep secrets outside shell history when possible. Use prompt-specific secure input instructions.

## Execution model

`SETUP.md` is master prompt. It instructs agent to read local repository files, connect to VPS, copy templates, run commands, and stop at checkpoints. Prompts are plain Markdown so operator can execute manually when agent cannot access environment.

## Prompt sequence

| Module | Purpose |
|---|---|
| 00 | Preflight checks |
| 01 | VPS base, Docker, Tailscale, firewall |
| 02 | Infrastructure databases and Caddy |
| 03 | Monitoring stack |
| 04 | Application services |
| 05 | AI platform services |
| 06 | Agent factory |
| 07 | Skills and MCP tooling |
| 08 | Dashboard deployment |
| 09 | Antagonist review flow |
| 10 | Floci file operations |
| 11 | Manager agent |
| 12 | AgentGateway |
| 13 | Credential export and dashboard import |

## Verification

After each checkpoint, confirm service health, file ownership, logs, dashboard registry, and rollback path. Do not continue when prompt verification fails.

## FAQ

**Can existing PostgreSQL be used?** Yes. Skip install commands and set `DATABASE_URL` in `/opt/cortexos/secrets/dashboard.env`.

**Can agent factory be skipped?** Yes. Dashboard and infrastructure can run without modules 06, 09, and 11.

**Where are credentials stored?** Host files under `/opt/cortexos/.secrets` and encrypted dashboard rows after import.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
