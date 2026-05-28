# Changelog

## Rebuild V2

- Added `PLAN.md` as the canonical rebuild plan and phase ledger.
- Added rebuild manifests and Bash tooling under `manifests/rebuild` and
  `scripts/rebuild`.
- Replaced the dashboard catalog with the host control/data plane service model.
- Rebuilt AgentGateway as a Python allowlist MCP proxy.
- Removed stale orchestration packages, templates, prompts, migrations, and
  runtime stack declarations from the repo source of truth.
