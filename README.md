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

CortexOS turns one Linux VPS into managed AI operations environment. Instead of opaque installer, repository ships audited Markdown setup modules, service templates, role definitions, dashboard, and event-driven orchestration stack. Human operator keeps control at explicit checkpoints while AI coding agents execute repeatable infrastructure work.

Supported host distros: Ubuntu 24.04 LTS, Ubuntu 25.x, Debian 13 (Trixie). Operator selects family in `prompts/os/00-os-selection.md`; all subsequent prompts dispatch via `scripts/pkg.sh`.

Target end state: Docker-backed services, SOPS-encrypted secrets, CloudEvents-signed NATS bus, hash-chained TimescaleDB audit, gVisor-sandboxed tool execution, self-hosted Langfuse LLM observability, SLSA-L2-signed images, Next.js dashboard for daily administration, and the Paperclip governance plane for cross-agent goals, approvals, and monthly budgets.

## What CortexOS provides

- **Prompt-driven deployment**: Sequential modules in `prompts/` define every setup step with checkpoints.
- **Enterprise control plane**: Next.js dashboard tracks services, credentials, agents, logs, storage, and terminal operations.
- **Agent factory**: Role files in `templates/agent-roles/` turn issues, NATS events, and Slack commands into scoped agent sessions.
- **Event backbone**: NATS JetStream carries `cortex.*` operational events between hooks, dashboard, consumer, and agents.
- **Human-readable audit trail**: Slack threads record decisions, build results, dispatches, and review outcomes.
- **Secure secrets lifecycle**: Host `.secrets/` files feed encrypted dashboard storage, rotation procedures, and allowlisted reads.
- **Observability stack**: Prometheus, Loki, Grafana, Fluent Bit, exporters, and health checks cover host and services.
- **Debian-family install path**: Ubuntu 24.04 / 25.x and Debian 13 Trixie supported via `scripts/pkg.sh` dispatcher and `prompts/os/` selection step.
- **Paperclip governance plane (required)**: Bridge service connects CortexOS to [Paperclip](https://paperclip.ing) for goals, monthly budgets, approval gates, and audit trail. CortexOS keeps execution authority; Paperclip owns governance. Bootstrap is not complete until Paperclip is wired in. See [docs/PAPERCLIP.md](docs/PAPERCLIP.md).

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
│ Operator laptop                                                  │
│   prompts/00-bootstrap.md  ·  scripts/bootstrap.sh  ·  age key   │
└────────────────────────────┬─────────────────────────────────────┘
                             │ SSH dispatch (git archive | tar -x, scp .env)
                             v
┌──────────────────────────────────────────────────────────────────┐
│ VPS  (Ubuntu 24/25 or Debian 13)                                 │
│                                                                  │
│  Next.js Dashboard  ──▶  NATS JetStream  (CloudEvents + HMAC)    │
│        ▲                       │                                  │
│        │                       ├─▶ cortex-consumer (durable)     │
│        │                       ├─▶ cortex-graph   (LangGraph)    │
│        │                       └─▶ cortex-sandbox-runner (gVisor)│
│        │                                                          │
│        └── PostgreSQL/Timescale (audit_log, langgraph_checkpoints,│
│            pending_approvals, paperclip_ticket_link)              │
│                                                                  │
│  Langfuse + ClickHouse  (OpenLLMetry LLM traces)                 │
│  Prometheus + Loki + Grafana  (host + service metrics)           │
│  SOPS+age secrets  ·  cosign+syft attestations  ·  Rekor anchor  │
└──────────────────────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full v2 substrate.

## Quick start

> **Before you begin:** read [REQUIREMENTS.md](REQUIREMENTS.md). The VPS
> must have Node 24, an AI coding agent CLI (Claude Code / Codex /
> Cursor), Tailscale joined to your tailnet, and a small set of CLI
> tools (`sops`, `cosign`, `syft`, `gh`, `age`, `jq`, `git`, `curl`)
> installed and authenticated before any install prompt is run.

CortexOS installs are now **laptop-driven**: you clone the repo on your
workstation, point an AI coding agent at the bootstrap prompt, and the
prompt orchestrates the VPS over SSH. The VPS does not need Git, an age
key, or any CortexOS code at the start — bootstrap pushes everything.

1. Clone the repository **on your laptop** (not on the VPS):

   ```bash
   git clone https://github.com/bloodf/cortexos.git
   cd cortexos
   ```

2. Provide VPS values in your laptop shell (or a `.env.local`):

   ```bash
   export CORTEX_HOST=<vps-hostname-or-ip>
   export CORTEX_USER=<sudo-user>
   export CORTEX_ROOT=/opt/cortexos
   export CORTEX_DOMAIN=<dashboard-domain>
   ```

   Confirm SSH works: `ssh "$CORTEX_USER@$CORTEX_HOST" true`.

3. Install local tooling: `brew install sops age` (macOS) or apt
   equivalent. Operator age key generation is handled by the bootstrap
   script — `~/.config/sops/age/keys.txt` is the only place a private
   key lives.

4. Open [`prompts/00-bootstrap.md`](prompts/00-bootstrap.md) in your AI
   coding agent and treat it as the session prompt. It will:

   - Verify laptop deps (`scripts/bootstrap.sh bootstrap_check_local_deps`).
   - Generate / register your operator age key in `.sops.yaml`.
   - Detect the remote OS family over SSH.
   - Push the repo to `/opt/cortexos` on the VPS via `git archive | ssh tar -x`.
   - Dispatch every `prompts/os/*` and `prompts/tools/*` step as
     `ssh $CORTEX_USER@$CORTEX_HOST '...'` from your laptop.
   - Decrypt SOPS secrets **locally** and `scp` the resulting `.env`
     files to `/opt/cortexos/.secrets/` (mode `0600`).

5. Stop at every `CHECKPOINT`. Confirm results before continuing.

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
| Paperclip governance | [docs/PAPERCLIP.md](docs/PAPERCLIP.md) |
| Agent graph (LangGraph sidecar) | [docs/AGENT-GRAPH.md](docs/AGENT-GRAPH.md) |
| LLM observability (Langfuse) | [docs/OBSERVABILITY-LLM.md](docs/OBSERVABILITY-LLM.md) |
| Audit (hash chain + Rekor) | [docs/AUDIT.md](docs/AUDIT.md) |
| Sandbox (gVisor tool exec) | [docs/SANDBOX.md](docs/SANDBOX.md) |
| Secrets (SOPS+age) | [docs/SECRETS.md](docs/SECRETS.md) |
| Supply chain (SLSA L2) | [docs/SUPPLY-CHAIN.md](docs/SUPPLY-CHAIN.md) |

## Screenshots

> Placeholder: add dashboard service matrix, credential browser, agent timeline, and observability dashboard screenshots after deployment branding stabilizes.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before opening issues or pull requests.

## License

Copyright (c) Heitor Ramon Ribeiro.

CortexOS is released under MIT License. See [LICENSE](LICENSE).
