# CortexOS Documentation

> Complete operating manual for CortexOS deployment, administration, security, and agent orchestration.

## Start here

1. Read [project README](../README.md) for overview.
2. Follow [Setup Guide](SETUP_GUIDE.md) for deployment.
3. Use [Architecture](ARCHITECTURE.md) to understand runtime design.
4. Review [Security](SECURITY.md) and [Credentials](CREDENTIALS.md) before production use.

## Core manuals

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System topology, layers, data stores, trust boundaries |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Prerequisites, prompt execution, verification, FAQ |
| [DASHBOARD.md](DASHBOARD.md) | Dashboard features, routes, APIs, operations |
| [SECURITY.md](SECURITY.md) | Threat model, controls, hardening checklist |
| [CREDENTIALS.md](CREDENTIALS.md) | Credential lifecycle, encryption, import, rotation |

## Agent and messaging manuals

| Document | Purpose |
|---|---|
| [AGENT_FACTORY.md](AGENT_FACTORY.md) | Agent role model, label state machine, dispatch flow |
| [AGENT-GATEWAY.md](AGENT-GATEWAY.md) | External gateway protocol and sequence diagrams |
| [A2A.md](A2A.md) | Agent-to-agent communication conventions |
| [NATS-CONTRACT.md](NATS-CONTRACT.md) | Subject taxonomy, payload schemas, versioning |
| [MESSAGING.md](MESSAGING.md) | Slack, Telegram, and notification rendering patterns |
| [PROJECT-BOTS.md](PROJECT-BOTS.md) | Project bot registration and per-project credentials |

## OS / install

| Document | Purpose |
|---|---|
| [FEDORA-SUPPORT.md](FEDORA-SUPPORT.md) | Fedora 40/41/42 support: prerequisites, SELinux, firewalld, known-good installs |
| [RHEL-FAMILY-SUPPORT.md](RHEL-FAMILY-SUPPORT.md) | RHEL / Rocky / AlmaLinux 9 and 10 support (filled in P6) |

## Operations manuals

| Document | Purpose |
|---|---|
| [OBSERVABILITY.md](OBSERVABILITY.md) | Metrics, logs, alerts, dashboards, runbooks |
| [MEMORY.md](MEMORY.md) | LEANN memory architecture and retrieval flow |
| [POSTGRES-LAYOUT.md](POSTGRES-LAYOUT.md) | Topology of the two PostgreSQL instances (dashboard vs. shared analytics) |
| [SECRETS-ROTATION.md](SECRETS-ROTATION.md) | Rotation procedures and verification steps |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Failure catalog and remediation recipes |

## Documentation standards

- Use CortexOS consistently.
- Prefer relative links.
- Include verification steps for operations.
- Never include live secrets or private infrastructure identifiers.
