# CortexOS

CortexOS is being rebuilt as a repo-declared Ubuntu 26.04 host plus isolated
Incus project instances.

The canonical implementation plan is [PLAN.md](PLAN.md). It records current
phase status, validation evidence, backup location, accepted risks, and the
next action gate. Rebuild manifests live in [manifests/rebuild](manifests/rebuild)
and executable tooling lives in [scripts/rebuild](scripts/rebuild).

## Current Direction

- Main host: control/data plane, dashboard, monitoring, 9Router, Ollama,
  Honcho, protected Hermes profiles, and shared services.
- Incus instances: project runtimes for `mementry`, `celebrar.me`, and `3guns`.
- Dashboard: LAN/tailnet full-control console with audited root-helper socket.
- AgentGateway: simple Python MCP allowlist proxy under
  [stacks/cortex-agentgateway](stacks/cortex-agentgateway).

## Operator Commands

```bash
scripts/rebuild/validate.sh --local
scripts/rebuild/plan.sh
scripts/rebuild/backup.sh --dry-run
scripts/rebuild/apply.sh --phase retired-runtime --dry-run --backup-dir <backup>
```

Do not treat older docs as operational truth unless they explicitly point back
to `PLAN.md`.
