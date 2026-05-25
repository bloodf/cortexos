# CortexOS

<p align="center">
  <img src=".github/assets/banner.png" alt="CortexOS - AI operations control plane" width="100%">
</p>

<p align="center">
  <strong>Self-hosted operations stack for Paperclip-governed AI work, Hermes profiles, Honcho memory, 9Router model routing, service health, and dashboard operations.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-24.x-339933.svg">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-10.x-F69220.svg">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black.svg">
  <img alt="Paperclip" src="https://img.shields.io/badge/Paperclip-workflow-purple.svg">
  <img alt="Hermes" src="https://img.shields.io/badge/Hermes-profiles-orange.svg">
  <img alt="9Router" src="https://img.shields.io/badge/9Router-model_gateway-0EA5E9.svg">
</p>

## Contents

- [Overview](#overview)
- [Apps Included](#apps-included)
- [Runtime](#runtime)
- [What CortexOS Provides](#what-cortexos-provides)
- [What CortexOS Is Not](#what-cortexos-is-not)
- [Install With An AI Agent](#install-with-an-ai-agent)
- [Core Endpoints](#core-endpoints)
- [Repository Layout](#repository-layout)
- [Validation](#validation)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

CortexOS turns a Linux host into a reproducible AI operations machine. The repo
ships the prompts, templates, service units, scripts, dashboard code, and
validation gates needed for an AI coding agent to install the same runtime on a
fresh host without copying private machine state.

The current runtime is intentionally narrow:

- **Paperclip** is the workflow and issue surface.
- **Hermes profiles** execute agent work.
- **Honcho** stores memory and knowledge.
- **9Router** routes every model call.
- **Ollama** provides local `nomic-embed-text:latest` embeddings for Honcho.
- **Dashboard** provides the operator UI for health, services, files, and admin
  workflows.

Dashboard seeds, install prompts, and templates must describe this runtime only.
Private project profiles, secrets, certificates, generated state, logs, and
machine-specific hostnames stay out of Git.

## Apps Included

CortexOS installs an operator machine, not just a chatbot. The base stack is a
set of local-first apps wired together through explicit prompts and validation
scripts.

| Area | Apps and services | Why they exist |
| --- | --- | --- |
| AI work | Paperclip, Hermes, AgentGateway, Cortex Hermes Agent Factory skill | Govern work, execute agents, expose approved tools, and create agents without dashboard factory controls |
| Model and memory | 9Router, Honcho, Ollama embeddings | Route all model calls, store memory, and keep embeddings local |
| Operator UI | CortexOS Dashboard, Hermes Web UI, Paperclip UI | Inspect services, profiles, identity files, health, and work state |
| Databases | PostgreSQL, Redis | Store dashboard/Paperclip data and provide cache/session infrastructure |
| Observability | Prometheus, Loki, Grafana, Fluent Bit, cAdvisor, Node Exporter, OpenTelemetry Collector, Langfuse | Watch services, logs, containers, host metrics, traces, and LLM activity |
| Host administration | Tailscale, Tailscale Serve, Cockpit, Webmin, fail2ban, dnsmasq, Docker, Dockhand | Keep the host reachable, locked down, and operable from the tailnet |
| Agent tooling | Kernel Browser, Cortex Sandbox Runner, 9Router skills, direct filesystem MCP per coding profile | Give agents browser, sandbox, routing, and project-file access without mixing profile boundaries |
| Developer substrate | Homebrew for Linux, Floci/LocalStack, scripts, templates, validation gates | Provide repeatable tools, local cloud emulation, and machine reproducibility checks |

Optional spokes add Home Assistant, Jellyfin, MongoDB, MySQL, pgAdmin,
RedisInsight, mongo-express, phpMyAdmin, Mail Guardian, and private project
profiles when the operator explicitly chooses them.

For the full catalog and install ownership, read [docs/APPS.md](docs/APPS.md).

## Runtime

```text
Operator / Dashboard
        |
        v
Paperclip -> Hermes profile -> 9Router -> model
                         |
                         v
                    Honcho memory

Honcho embeddings -> Ollama nomic-embed-text:latest
```

There is no separate workflow bus, custom orchestration sidecar, direct model
provider path, or dashboard Agent Factory UI. Cortex Hermes is the only profile
allowed to act as the Agent Factory through its dedicated skill.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the deeper runtime, data, network,
profile, and validation model.

## What CortexOS Provides

- **Chat-first AI installation**: prompts ask for required values in chat, wait
  for answers, and then produce concrete commands.
- **Paperclip-governed work**: Paperclip owns issues, approvals, and agent work
  state.
- **Hermes profile runtime**: each profile has isolated identity files, env,
  home, tools, and Paperclip bindings.
- **Honcho memory**: durable memory and knowledge storage with local embeddings.
- **9Router model gateway**: one OpenAI-compatible route for model access.
- **Native dashboard**: Next.js systemd service on loopback, published through
  the chosen operator access path.
- **Operational checks**: scripts verify runtime sync, Docker naming, prompt
  contract, leaks, Paperclip/Hermes registration, and production readiness.
- **Public-safe repository contract**: docs and seeds explain the machine
  without embedding secrets or private project data.

## What CortexOS Is Not

| Not this | CortexOS choice |
| --- | --- |
| One-click black-box installer | AI-guided prompt execution with explicit checks |
| SaaS platform | Self-hosted stack on infrastructure you control |
| Kubernetes distribution | Single-host runtime with direct systemd and compose units |
| Agent swarm bus | Paperclip-governed Hermes profiles |
| Secret vault replacement | Runtime secret layout plus rotation docs |
| Direct provider integration | Model calls route through 9Router |
| Project data backup in Git | Runtime state stays local and private |

## Install With An AI Agent

Start new installs by pasting [docs/AI-INSTALLER-PROMPT.md](docs/AI-INSTALLER-PROMPT.md)
into the AI agent that will run the setup. The prompt is the canonical,
copy/paste entry point for Codex, Claude Code, Cursor, OpenCode, Gemini, or a
similar coding harness.

```text
You are installing CortexOS from this repository.

Read these files before taking action:

- README.md
- docs/AI-INSTALLER-PROMPT.md
- docs/AI-REPLICATION.md
- SETUP.md
- prompts/CHAT-INPUT-CONTRACT.md
- prompts/00-bootstrap.md
- prompts/tools/_order.md
- prompts/tools/99-final-validation.md

Install a reproducible CortexOS machine at /opt/cortexos.
Do not assume any environment variables already exist.
Ask me for required values in chat, wait for my answer, and then write concrete
commands using those answered values.

Never paste secrets into Git, prompts, docs, dashboard seeds, logs, shell
history, or command transcripts. Runtime secrets belong only under
/opt/cortexos/.secrets with mode 600.

Use the current runtime only:

Paperclip -> Hermes profile -> 9Router -> model
Hermes -> Honcho memory
Honcho embeddings -> Ollama nomic-embed-text:latest

Do not install a custom workflow bus, relay, separate scheduler, orchestration
sidecar, direct provider model path, or dashboard Agent Factory UI. Cortex
Hermes is the only profile allowed to act as the Agent Factory.

Start by asking me for:

- target_host
- sudo_user
- cortex_root, default /opt/cortexos
- cortex_domain
- whether this is a new machine or repair of an existing machine

Then run prompts/00-bootstrap.md, follow every core prompt in
prompts/tools/_order.md, run prompts/tools/99-final-validation.md, and finish
with the repository and runtime gates listed in README.md.
```

## Core Endpoints

| Service | Local endpoint | Secret source |
| --- | --- | --- |
| 9Router | `http://127.0.0.1:11434/v1` | `/opt/cortexos/.secrets/9router.env` |
| Honcho | `http://127.0.0.1:18690` | `/opt/cortexos/.secrets/honcho.env` |
| Ollama embeddings | `http://127.0.0.1:11435/v1` | systemd service env |
| Hermes profile API | `http://127.0.0.1:18691+` | `/opt/cortexos/.secrets/hermes/<profile>.env` |
| Paperclip proxy | `http://127.0.0.1:3033/api` | `/opt/cortexos/.secrets/paperclip.env` |
| Paperclip upstream | `http://127.0.0.1:3034` | `/opt/cortexos/.secrets/paperclip.env` |
| Dashboard | `http://127.0.0.1:3080` | `/opt/cortexos/.secrets/dashboard.env` |
| Hermes Web UI | `http://127.0.0.1:9119` | Hermes profile env |

Public access is derived during install. Migrations and seeds must not hardcode
machine-specific domains.

## Repository Layout

```text
README.md                 Project entry point
SETUP.md                  Operator setup flow
ARCHITECTURE.md           Runtime architecture
REQUIREMENTS.md           Pre-install host requirements
docs/                     Operating manuals and replication contracts
prompts/                  Chat-first install modules
scripts/                  Host, Paperclip, Hermes, and validation utilities
templates/                Systemd units, Hermes templates, skills, workflows
packages/                 Dashboard, telemetry, audit, mail guardian, adapters
stacks/                   Runtime stack definitions
.github/assets/           README and project artwork
```

## Validation

Run these before treating the repository and machine as reproducible:

```bash
rtk pnpm check:prompt-chat-contract
rtk pnpm check:repo-leaks
rtk pnpm audit:docker-names
rtk pnpm audit:runtime-sync -- --strict
rtk pnpm --filter cortexos-scripts test
rtk pnpm --filter @cortexos/dashboard test
scripts/cortex-production-readiness.sh
```

Expected runtime state:

- no numbered duplicate Docker containers
- Paperclip/Hermes registration smoke passes
- Honcho routes text-generation features through 9Router
- Honcho embeddings are 768-dimensional from Ollama
- `/opt/cortexos` matches the repository where the sync audit expects it
- dashboard and service catalog use public-safe, current-runtime seeds

## Documentation

| Topic | Document |
| --- | --- |
| AI installer prompt | [docs/AI-INSTALLER-PROMPT.md](docs/AI-INSTALLER-PROMPT.md) |
| Replication contract | [docs/AI-REPLICATION.md](docs/AI-REPLICATION.md) |
| Setup | [SETUP.md](SETUP.md) |
| Requirements | [REQUIREMENTS.md](REQUIREMENTS.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Services | [docs/SERVICES.md](docs/SERVICES.md) |
| Dashboard | [docs/DASHBOARD.md](docs/DASHBOARD.md) |
| Paperclip | [docs/PAPERCLIP.md](docs/PAPERCLIP.md) |
| Secrets | [docs/SECRETS.md](docs/SECRETS.md) |
| Credentials | [docs/CREDENTIALS.md](docs/CREDENTIALS.md) |
| Security | [docs/SECURITY.md](docs/SECURITY.md) |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Full app catalog | [docs/APPS.md](docs/APPS.md) |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md),
and [SECURITY.md](SECURITY.md) before opening issues or pull requests. Keep
installer prompts, templates, and dashboard seeds aligned with the current
runtime.

## License

Copyright (c) Heitor Ramon Ribeiro.

CortexOS is released under the MIT License. See [LICENSE](LICENSE).
