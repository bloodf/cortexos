# CortexOS

<p align="center">
  <img src=".github/assets/banner.png" alt="CortexOS — AI homelab control plane" width="100%">
</p>

<p align="center">
  <strong>Self-hosted operating layer for infrastructure operations, Paperclip-governed AI work, Hermes agent profiles, service health, secrets, and observability.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Node" src="https://img.shields.io/badge/Node.js-22%2B-339933.svg">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black.svg">
  <img alt="Paperclip" src="https://img.shields.io/badge/Paperclip-governed-purple.svg">
  <img alt="Hermes" src="https://img.shields.io/badge/Hermes-profiles-orange.svg">
</p>

## Contents

- [Overview](#overview)
- [What CortexOS provides](#what-cortexos-provides)
- [What CortexOS is not](#what-cortexos-is-not)
- [Current runtime architecture](#current-runtime-architecture)
- [Agent workforce](#agent-workforce)
- [Quick start](#quick-start)
- [Repository layout](#repository-layout)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

CortexOS turns a Linux host into a managed AI operations environment. Instead of an opaque installer, the repository ships audited Markdown setup modules, service templates, role definitions, dashboard code, and governance-aware agent runtime configuration.

The current runtime is deliberately narrower and safer than earlier experiments:

- **Paperclip** is the workflow, issue, approval, budget, and audit surface.
- **Hermes profiles** execute agent work.
- **Honcho** provides memory and knowledge storage.
- **9Router** is the model gateway for all model calls.
- **Dashboard** provides the administration and service catalog UI.

Retired custom agent buses and sidecar workflow stacks are not part of the active runtime.

## What CortexOS provides

- **Prompt-driven deployment**: Sequential modules in `prompts/` define setup steps with checkpoints.
- **Administration dashboard**: Next.js UI for services, projects, agents, health, and operational views.
- **Paperclip-governed agents**: Role templates in `templates/agent-roles/` map product, engineering, QA, marketing, review, and red-team work into scoped Paperclip/Hermes agents.
- **Hermes profile runtime**: Per-profile execution homes, model routing, Paperclip adapter integration, and Honcho workspace mapping.
- **Memory and knowledge**: Honcho stores profile memory and uses local embeddings.
- **Model routing**: 9Router exposes an OpenAI-compatible model gateway for Hermes and agent tooling.
- **Secrets discipline**: Runtime secrets live outside the repository; templates and docs describe layout without embedding private values.
- **Observability**: Prometheus, Loki, Grafana, service health, and dashboard catalog support operational visibility.

## What CortexOS is not

| Not this | CortexOS choice |
|---|---|
| One-click installer | Operator-guided prompt execution with checkpoints |
| SaaS platform | Self-hosted stack on infrastructure you control |
| Kubernetes distribution | Single-host service topology and explicit templates |
| Unbounded agent swarm | Paperclip-scoped agents with hierarchy, budgets, and audit |
| Secret vault replacement | Practical runtime secret layout plus rotation docs |
| Direct model-provider integration | Model calls route through 9Router |

## Current runtime architecture

```text
Paperclip issue / approval / budget
        │
        v
hermes-paperclip-adapter
        │
        v
Hermes profile ───────────────┐
        │                     │
        v                     v
9Router model gateway     Honcho memory / knowledge
        │
        v
Model provider selected by 9Router
```

Dashboard, migrations, seeds, and templates describe this current runtime only.

## Agent workforce

The active role template set supports a deeper organization:

```text
CEO
├── CTO
│   ├── REVIEWER
│   ├── BUG-BOUNTY
│   ├── STAFF-FRONTEND
│   │   ├── ENG-WEB-FRONTEND
│   │   └── ENG-WEB-FRONTEND-2
│   ├── STAFF-BACKEND
│   │   ├── ENG-API
│   │   └── ENG-API-2
│   ├── STAFF-RN
│   │   ├── ENG-RN-IOS
│   │   └── ENG-RN-ANDROID
│   └── QA-LEAD
│       ├── QA-E2E
│       └── QA-UNIT
├── CPO
│   ├── PM
│   └── PO
└── CRO
    ├── MKT-CONTENT
    └── MKT-CREATIVE
```

Role definitions live in `templates/agent-roles/`. Registration and adapter defaults live in `scripts/paperclip-register-roles.ts`.

## Quick start

1. Read [REQUIREMENTS.md](REQUIREMENTS.md).
2. Follow [SETUP.md](SETUP.md).
3. Execute install prompts in the canonical order from [prompts/tools/_order.md](prompts/tools/_order.md).
4. Stop at every checkpoint and verify before continuing.

Core local service defaults are documented with `localhost` endpoints in the relevant prompt and service docs. Runtime secrets are expected under `/opt/cortexos/.secrets/` on the target host, not in this repository.

## Repository layout

```text
README.md                 Project entry point
SETUP.md                  Operator setup prompt and execution rules
ARCHITECTURE.md           High-level runtime architecture
docs/                     Operating manuals and security notes
prompts/                  Sequential deployment modules
scripts/                  Host, Paperclip, Hermes, and validation utilities
templates/                Systemd units, role templates, secrets templates, workflows
packages/                 Dashboard, telemetry, audit, mail guardian, adapters
stacks/                   Runtime stack definitions
.github/                  CI, release, and repository automation
```

## Documentation

| Topic | Document |
|---|---|
| Documentation index | [docs/README.md](docs/README.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Setup | [SETUP.md](SETUP.md) |
| Requirements | [REQUIREMENTS.md](REQUIREMENTS.md) |
| Dashboard | [docs/DASHBOARD.md](docs/DASHBOARD.md) |
| Credentials | [docs/CREDENTIALS.md](docs/CREDENTIALS.md) |
| Security | [docs/SECURITY.md](docs/SECURITY.md) |
| Security checklist | [docs/SECURITY-CHECKLIST.md](docs/SECURITY-CHECKLIST.md) |
| Paperclip | [docs/PAPERCLIP.md](docs/PAPERCLIP.md) |
| Observability | [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) |
| Backup and updates | [docs/BACKUP-AND-AUTO-UPDATE.md](docs/BACKUP-AND-AUTO-UPDATE.md) |
| Secrets | [docs/SECRETS.md](docs/SECRETS.md) |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |

## Screenshots

> Placeholder: add dashboard service matrix, project view, agent workforce tree, and observability screenshots after branding stabilizes.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before opening issues or pull requests.

## License

Copyright (c) Heitor Ramon Ribeiro.

CortexOS is released under the MIT License. See [LICENSE](LICENSE).
