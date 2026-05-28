# Architecture

See `../PLAN.md` for the complete architecture.

The rebuild separates:

- Host control/data plane.
- Protected host Hermes profiles.
- Isolated Incus project instances.
- Per-project service credentials and database grants.
- Audited dashboard helper operations.

The repo implementation surface is `manifests/rebuild/`, `scripts/rebuild/`,
`packages/cortex-dashboard/`, and `stacks/cortex-agentgateway/`.
