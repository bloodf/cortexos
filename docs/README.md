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
| [SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md) | Operator-facing summary of every defensive control (UFW, SSH, sysctl, fail2ban, AppArmor, auditd) |
| [SERVICES.md](SERVICES.md) | Service inventory: ports, public URLs, default credentials, firewall posture |
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
| [PAPERCLIP.md](PAPERCLIP.md) | Paperclip governance plane: architecture, auth, secret rotation, ops runbook |
| [AGENT-GRAPH.md](AGENT-GRAPH.md) | V7 LangGraph sidecar: node contracts, resume semantics, checkpoint lifecycle |

## OS / install

Supported host OS families: Ubuntu 24.04 LTS, Ubuntu 25.x, Debian 13 (Trixie). OS routing handled by `scripts/os-detect.sh` + `scripts/pkg.sh`.

## Operations manuals

| Document | Purpose |
|---|---|
| [OBSERVABILITY.md](OBSERVABILITY.md) | Metrics, logs, alerts, dashboards, runbooks |
| [OBSERVABILITY-LLM.md](OBSERVABILITY-LLM.md) | LLM-call traces via self-hosted Langfuse + ClickHouse + OpenLLMetry |
| [AUDIT.md](AUDIT.md) | Hash-chained audit hypertable + Sigstore Rekor anchoring, tamper-detection runbook |
| [SANDBOX.md](SANDBOX.md) | gVisor (runsc) tool-exec sandbox runner: threat model, isolation guarantees, operational runbook |
| [SECRETS.md](SECRETS.md) | SOPS+age encrypted-in-Git secret pipeline, operator age key lifecycle |
| [SECRETS-ROTATION.md](SECRETS-ROTATION.md) | Rotation procedures and verification steps |
| [SUPPLY-CHAIN.md](SUPPLY-CHAIN.md) | SLSA L2 verification protocol, cosign + syft + GH attestations, threat model |
| [MEMORY.md](MEMORY.md) | LEANN memory architecture and retrieval flow |
| [POSTGRES-LAYOUT.md](POSTGRES-LAYOUT.md) | Topology of the two PostgreSQL instances (dashboard vs. shared analytics) |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Failure catalog and remediation recipes |

## Documentation standards

- Use CortexOS consistently.
- Prefer relative links.
- Include verification steps for operations.
- Never include live secrets or private infrastructure identifiers.
