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
| OS | Ubuntu 22.04 / 24.04 LTS, Fedora 40 / 41 / 42, or RHEL-family 9 / 10 (Rocky, Alma) |
| CPU | 4+ cores |
| Memory | 16 GB+ |
| Disk | 200 GB+ SSD |
| Access | SSH as sudo user |
| Network | Domain or Tailscale hostname |
| Tools | Git, AI coding agent, SSH client |

Before running any module, pick a distro family with
[`prompts/os/00-os-selection.md`](../prompts/os/00-os-selection.md);
it exports `CORTEX_OS_FAMILY` and gates every package-management call
through `scripts/pkg.sh`. Distro-specific prereqs live in
`prompts/os/10-{ubuntu,fedora,rhel}-prereqs.md` (and
[FEDORA-SUPPORT.md](FEDORA-SUPPORT.md) /
[RHEL-FAMILY-SUPPORT.md](RHEL-FAMILY-SUPPORT.md) for long-form notes).

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

## Optional: Paperclip governance plane

After module 13, operators who want the Paperclip governance plane run
the Paperclip prompts in order:

| Prompt                                         | Stage                            |
|------------------------------------------------|----------------------------------|
| `prompts/paperclip/00-overview.md`             | Authority split + decision gate  |
| `prompts/paperclip/10-install.md`              | Install bridge dependencies      |
| `prompts/paperclip/20-bridge.md`               | Bring up the bridge service      |
| `prompts/paperclip/30-register-roles.md`       | Register CortexOS roles          |
| `prompts/paperclip/40-routines-and-budgets.md` | Configure routines + budgets     |
| `prompts/paperclip/50-approval-gates.md`       | Wire approval gates              |
| `prompts/paperclip/60-smoke-test.md`           | Run end-to-end 28-step smoke     |
| `prompts/paperclip/70-rollback.md`             | Practice rollback drill          |

The Paperclip layer is fully optional: the dashboard, NATS, and consumer
run unchanged when these prompts are skipped. See
[PAPERCLIP.md](PAPERCLIP.md) for architecture and ops runbook.

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
