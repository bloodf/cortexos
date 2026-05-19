# CortexOS PostgreSQL Layout

> Live topology of the two PostgreSQL instances that ship with CortexOS,
> with rationale for the split. CortexOS is **PostgreSQL only** — no
> MySQL anywhere in the stack.

## Contents

- [Overview](#overview)
- [Instance 1 — `cortex-dashboard-db`](#instance-1--cortex-dashboard-db)
- [Instance 2 — `cortex-postgresql`](#instance-2--cortex-postgresql)
- [Why two instances](#why-two-instances)
- [Backups](#backups)
- [Related docs](#related-docs)

## Overview

| Container          | Image          | Bind                       | Role                                                      |
|--------------------|----------------|----------------------------|-----------------------------------------------------------|
| `cortex-dashboard-db` | `postgres:17`  | `127.0.0.1:5432`            | Dashboard data only (users, sessions, projects, audit).   |
| `cortex-postgresql`   | `postgres:18`  | internal docker network    | Shared backend store: OpenViking memory + Langfuse v3.    |

Both containers are managed by docker compose under
`stacks/postgresql/`. Neither container exposes a public port; access
is via loopback or via the `cortex-internal` docker network only.

## Instance 1 — `cortex-dashboard-db`

- **Image:** `postgres:17`.
- **Port:** `127.0.0.1:5432` (loopback only).
- **Owners:** dashboard process, dashboard migrate runner.
- **Databases:** `cortex_dashboard` (canonical).
- **Trust boundary:** dashboard runs as a non-root system user; only
  the dashboard service holds the connection string in
  `/opt/cortexos/.secrets/dashboard.env`.
- **Why a dedicated instance:** keeps user PII (session cookies,
  audit logs) isolated from the shared analytical / memory tier, and
  lets the dashboard land on Postgres 17 without dragging Langfuse and
  OpenViking forward at the same time.

## Instance 2 — `cortex-postgresql`

- **Image:** `postgres:18`.
- **Port:** none publicly bound; reachable on docker network
  `cortex-internal` as host `cortex-postgresql:5432`.
- **Databases:**
  - `openviking` — episodic and semantic memory for OpenClaw
    (`32-openviking.md`).
  - `langfuse`  — Langfuse v3 traces, prompts, eval scores
    (`55-langfuse.md`, full install in `55-langfuse.md`).
- **Trust boundary:** only services on the `cortex-internal`
  network can resolve the host; secrets live under
  `/opt/cortexos/.secrets/{openviking.env,langfuse.env}`.

## Why two instances

1. **Version cadence.** Dashboard tracks Postgres 17 for stability;
   the analytics tier moves to 18 first because Langfuse and
   OpenViking benefit from the newer planner and `pgvector` /
   incremental sort improvements.
2. **Blast radius.** A schema migration on the memory / analytics
   side cannot lock or block dashboard reads.
3. **Backup cadence differs.** Dashboard DB ships hourly logical
   dumps; the shared instance ships daily logical dumps plus weekly
   physical snapshots (see [Backups](#backups)).

## Backups

- `cortex-dashboard-db`: `pg_dump --format=custom` hourly to
  `/opt/cortexos/backups/dashboard/`. 30-day retention.
- `cortex-postgresql`: `pg_dumpall` nightly to
  `/opt/cortexos/backups/analytics/` (90-day retention) plus a
  weekly Sunday physical snapshot via `pg_basebackup`.

Restore drills are documented in `TROUBLESHOOTING.md`.

## Related docs

- [Documentation index](README.md)
- [Memory architecture](MEMORY.md)
- `prompts/tools/14-postgresql.md`
- `prompts/tools/32-openviking.md`
- `prompts/tools/55-langfuse.md`
