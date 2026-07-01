# CortexOS — Agent Instructions

> **🤖 This file is for AI agents (Claude, Kimi, Gemini, etc.) working on CortexOS.**
> Human contributors should start with [`README.md`](../README.md) or [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).

agentic-engineering: opt-in

Orchestration protocol: [`CLI_ORCHESTRATOR.md`](CLI_ORCHESTRATOR.md) — roles,
pipeline, planning loop, micro-plan gate, implementation/validation/shipping
loops, OMC and Claude Code usage rules, Headroom and claude-mem integration.

Self-hosted AI infrastructure system: deployment docs and installer prompts, Docker Compose stacks for databases/monitoring, a TanStack Start + React 19 dashboard for server control, OpenAI-compatible model endpoint configuration, and agent orchestration templates. Target host runs Ubuntu 24.04+ (Debian 13 supported) at `/opt/cortexos`.

## Decisions

- Secrets are SOPS+age encrypted (`.enc.yaml`); never commit plaintext secrets. See `docs/SECRETS.md`.
- Single Tailscale MagicDNS FQDN with path-based reverse proxy (Caddy) for all web UIs - no subdomains.
- Untrusted code runs sandboxed via `stacks/cortex-sandbox-runner` (gVisor).
- Package management on hosts goes through `scripts/pkg.sh`, not raw `apt-get`.
- Langfuse v3 (ClickHouse+MinIO) is the observability stack; Opik is retired.

## Conventions

- pnpm workspace monorepo, Node.js 22. Lint: `pnpm lint`.
- Prompts in `prompts/` use stepwise, formal language; templates in `templates/` must be safe to copy to servers verbatim.
- Docs include verification steps. Test before claiming done; update docs when behavior changes.
- E2E GitHub workflows are manual-trigger only.

## Repo map

- `prompts/` - installer and tool prompts executed step-by-step on hosts
- `templates/` - systemd units and config templates copied to servers
- `stacks/` - Docker Compose service stacks
- `packages/dashboard-next/` - TanStack Start + React 19 control dashboard (3 locales: en, es, pt-br); live on `cortex-dashboard.service` at `:3080`
- `packages/cortex-telemetry/` - OpenLLMetry instrumentation for Langfuse
- `scripts/` - host ops scripts (`pkg.sh`, smoke tests, backups)
- `docs/` - deployment, secrets, and architecture docs
