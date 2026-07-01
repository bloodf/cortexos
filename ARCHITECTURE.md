# CortexOS Architecture

See [`docs/internal/architecture-plan.md`](docs/internal/architecture-plan.md) for the full architecture plan.

Summary:

- Host keeps shared services and protected Hermes identities.
- Projects run in unprivileged Incus instances with their own Tailscale SSH.
- Access to shared databases, buckets, queues, and secrets is per project.
- Obot MCP gateway platform with stdout audit records.
- Dashboard root operations go through a Unix-socket helper with Postgres and
   journald audit.

> Honcho is kept deployed read-only as a rollback safety net; Hindsight is the
> primary memory backend.

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│              HOST SERVER                │
│                                         │
│  ┌──────────────┐  ┌──────────────┐    │
│  │   Shared     │  │   Dashboard  │    │
│  │   Services   │  │   (Web UI)   │    │
│  │              │  │              │    │
│  │  Postgres    │  │  PAM Auth    │    │
│  │  Redis       │  │  Audit Log   │    │
│  │  LLM endpoint│  │              │  │
│  │  Hindsight   │  │              │  │
│  │  Honcho*     │  │              │  │
│  └──────┬───────┘                      │
│         │                              │
│  ┌──────┴───────────────────────┐     │
│  │      Incus Projects          │     │
│  │  ┌─────┐ ┌─────┐ ┌─────┐    │     │
│  │  │Proj1│ │Proj2│ │Proj3│    │     │
│  │  └─────┘ └─────┘ └─────┘    │     │
│  └──────────────────────────────┘     │
└─────────────────────────────────────────┘


