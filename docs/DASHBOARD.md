# CortexOS Dashboard

> Next.js administration interface for services, credentials, agents, storage, terminal access, and operational health.

## Contents

- [Overview](#overview)
- [Feature map](#feature-map)
- [Runtime](#runtime)
- [API surfaces](#api-surfaces)
- [Security controls](#security-controls)
- [Screenshots](#screenshots)
- [Related docs](#related-docs)

## Overview

Dashboard is Next.js 16 application in `dashboard/`. It runs on port 3080 behind Caddy, uses PostgreSQL for state, and probes local/host services through configured health checks.

## Feature map

| Area | Capability |
|---|---|
| Services | Registry, health checks, categories, open links |
| Credentials | Import, encrypted storage, masked viewing, reveal approval |
| Agents | Activity, dispatches, audit trails |
| Environment browser | Allowlisted env file viewing and editing flows |
| Terminal | Controlled command workflows |
| Admin projects | Per-project bot credential paths |

## Local development

```bash
cd dashboard
npm install
npm run test
npm run dev          # custom server on PORT=3000
```

## Production deployment

Production runs as a Docker Compose service built **on the VPS** from
the repo tree materialized by the bootstrap flow (`git archive | ssh
tar -x`). No rsync, no laptop-side Next.js build, no systemd unit.

```bash
# On the VPS:
cd /opt/cortexos/stacks/cortex-dashboard
docker compose up -d --build
curl -fsS http://127.0.0.1:3080/api/health
```

Key facts:

- Image base: `node:22-slim`. Runtime user: non-root `node`. PID 1:
  `dumb-init`.
- Compose file: `stacks/cortex-dashboard/docker-compose.yml`
  (build context `../../dashboard`).
- Runtime env: `/opt/cortexos/.secrets/dashboard.env`
  (`DB_*`, `CORTEX_MASTER_KEY`, `OPENCLAW_BASE`, ...).
- Network: joins the `cortex-net` external Docker network. Postgres
  and NATS are reached through that network (or `host.docker.internal`
  for host-installed Postgres).
- Migrations: container entrypoint waits on Postgres, then runs
  `node scripts/migrate.js` (idempotent).
- Port: `3080:3080`. Caddy continues to reverse-proxy in front.

See [stacks/cortex-dashboard/README.md](../stacks/cortex-dashboard/README.md)
and [prompts/tools/70-dashboard.md](../prompts/tools/70-dashboard.md)
for the full operator flow.

## API surfaces

| Route group | Purpose |
|---|---|
| `/api/auth/*` | Session and login flows |
| `/api/env-browser/*` | Allowlisted env reads and writes |
| `/api/cortex/*` | Agent and tool interactions |
| `/api/admin/*` | Admin-only configuration |
| `/api/health` | Health reporting |

## Security controls

- Admin-only privileged endpoints.
- Confirmation tokens for sensitive tools.
- Path allowlist in `dashboard/src/lib/secrets/allowlist.ts`.
- Audit logging for reveal, write, and dispatch operations.

## Screenshots

> Placeholder: add service grid, credential import, agent timeline, and observability cards after production capture.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
