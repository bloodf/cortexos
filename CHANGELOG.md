# Changelog

## Rebuild V2

- Added `PLAN.md` as the canonical rebuild plan and phase ledger.
- Added rebuild manifests and Bash tooling under `manifests/rebuild` and
  `scripts/rebuild`.
- Replaced the dashboard catalog with the host control/data plane service model.
- Rebuilt AgentGateway as a Python allowlist MCP proxy.
- Removed stale orchestration packages, templates, prompts, migrations, and
  runtime stack declarations from the repo source of truth.
- Fixed the `incus-base-image` gastown variant (first successful build): apply.sh
  re-extracts the stack archive before `gastown-provision.sh` (base-image
  provisioning deletes the staging dir); the beads installer runs in a login
  shell so its PATH self-check passes; and `run_as_user` does `cd ~` so `go` can
  stat its working directory. Publishes `cortexos-gastown-base`.
