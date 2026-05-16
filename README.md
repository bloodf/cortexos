# CortexOS

<p align="center">
  <img src=".github/assets/banner.png" alt="CortexOS — AI homelab control plane" width="100%">
</p>

<p align="center">
  <strong>AI-driven operating layer for self-hosted infrastructure, agent orchestration, and secure home-server operations.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-green.svg">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-24.x-339933.svg">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black.svg">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
</p>

## Contents

- [Overview](#overview)
- [What CortexOS provides](#what-cortexos-provides)
- [What CortexOS is not](#what-cortexos-is-not)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Repository layout](#repository-layout)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

CortexOS turns one Ubuntu VPS into managed AI operations environment. Instead of opaque installer, repository ships audited Markdown setup modules, service templates, role definitions, dashboard, and event-driven orchestration stack. Human operator keeps control at explicit checkpoints while AI coding agents execute repeatable infrastructure work.

Target end state: Docker-backed services, secure credential storage, observability, NATS event bus, Slack-centered operations log, OpenClaw agent dispatch, and Next.js dashboard for daily administration.

## What CortexOS provides

- **Prompt-driven deployment**: Sequential modules in `prompts/` define every setup step with checkpoints.
- **Enterprise control plane**: Next.js dashboard tracks services, credentials, agents, logs, storage, and terminal operations.
- **Agent factory**: Role files in `templates/agent-roles/` turn issues, NATS events, and Slack commands into scoped agent sessions.
- **Event backbone**: NATS JetStream carries `cortex.*` operational events between hooks, dashboard, consumer, and agents.
- **Human-readable audit trail**: Slack threads record decisions, build results, dispatches, and review outcomes.
- **Secure secrets lifecycle**: Host `.secrets/` files feed encrypted dashboard storage, rotation procedures, and allowlisted reads.
- **Observability stack**: Prometheus, Loki, Grafana, Fluent Bit, exporters, and health checks cover host and services.

## What CortexOS is not

| Not this | CortexOS choice |
|---|---|
| One-click installer | Operator-guided prompt execution with checkpoints |
| SaaS platform | Self-hosted stack on infrastructure you control |
| Kubernetes distribution | Single-host Docker Compose topology |
| Unbounded agent swarm | Role-scoped agent sessions with audit and approval gates |
| Secret vault replacement | Practical encrypted operational store plus rotation docs |

## Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                         Operator / Owner                         │
│             Dashboard, Slack, SSH, Tailscale, GitHub             │
└───────────────┬─────────────────────┬────────────────────────────┘
                │                     │
                v                     v
┌──────────────────────────┐   ┌──────────────────────────┐
│ Next.js Dashboard        │   │ Slack Operations Threads  │
│ services, agents, creds  │   │ decisions, approvals      │
└───────────────┬──────────┘   └──────────────┬───────────┘
                │                             │
                v                             v
┌──────────────────────────────────────────────────────────────────┐
│ NATS / JetStream: cortex.<domain>.<scope>.<verb>                 │
└───────────────┬──────────────────────────────────────────────────┘
                │
                v
┌──────────────────────────┐   HTTP   ┌──────────────────────────┐
│ cortex-consumer          ├─────────▶│ OpenClaw Gateway          │
│ routing, Slack, approval │          │ agent process dispatch    │
└───────────────┬──────────┘          └──────────────┬───────────┘
                │                                    │
                v                                    v
┌──────────────────────────────────────────────────────────────────┐
│ Docker services, databases, monitoring, AI platform, home apps    │
└──────────────────────────────────────────────────────────────────┘
```

See [Architecture](ARCHITECTURE.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full design.

## Quick start

1. Clone repository:

   ```bash
   git clone https://github.com/bloodf/cortexos.git
   cd cortexos
   ```

2. Open [`SETUP.md`](SETUP.md) in AI coding agent and treat it as session prompt.

3. Provide VPS values:

   ```bash
   export CORTEX_HOST=<vps-hostname-or-ip>
   export CORTEX_USER=<sudo-user>
   export CORTEX_ROOT=/opt/cortexos
   export CORTEX_DOMAIN=<dashboard-domain>
   ```

4. Execute prompt modules in order, from `prompts/00-preflight.md` through `prompts/13-credentials-export.md`.

5. Stop at every `CHECKPOINT`, verify result, then continue.

## Repository layout

```text
README.md                 Project entry point
SETUP.md                  Operator setup prompt and execution rules
ARCHITECTURE.md           High-level runtime architecture
docs/                     Detailed operating manuals
prompts/                  Sequential deployment modules
templates/                Compose files, scripts, systemd units, roles, workflows
stacks/                   Runtime stack definitions and consumer daemon
dashboard/                Next.js 16 administration interface
scripts/                  Host utility scripts
.github/assets/           Logo and README visual assets
```

## Documentation

| Topic | Document |
|---|---|
| Documentation index | [docs/README.md](docs/README.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Setup guide | [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) |
| Dashboard | [docs/DASHBOARD.md](docs/DASHBOARD.md) |
| Credentials | [docs/CREDENTIALS.md](docs/CREDENTIALS.md) |
| Security model | [docs/SECURITY.md](docs/SECURITY.md) |
| Agent factory | [docs/AGENT_FACTORY.md](docs/AGENT_FACTORY.md) |
| Agent gateway | [docs/AGENT-GATEWAY.md](docs/AGENT-GATEWAY.md) |
| NATS contract | [docs/NATS-CONTRACT.md](docs/NATS-CONTRACT.md) |
| Messaging | [docs/MESSAGING.md](docs/MESSAGING.md) |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |

## Screenshots

> Placeholder: add dashboard service matrix, credential browser, agent timeline, and observability dashboard screenshots after deployment branding stabilizes.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before opening issues or pull requests.

## License

Copyright (c) Heitor Ramon Ribeiro.

CortexOS is released under MIT License. See [LICENSE](LICENSE).
