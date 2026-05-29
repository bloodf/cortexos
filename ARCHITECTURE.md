# CortexOS Architecture

`PLAN.md` is the source of truth for the rebuild architecture.

Summary:

- Host keeps shared services and protected Hermes identities.
- Projects run in unprivileged Incus instances with their own Tailscale SSH.
- Access to shared databases, buckets, queues, and secrets is per project.
- Obot MCP gateway platform with stdout audit records.
- Dashboard root operations go through a Unix-socket helper with Postgres and
  journald audit.

Implementation manifests are in `manifests/rebuild/`.
