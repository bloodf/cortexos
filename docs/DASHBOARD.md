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

## Runtime

```bash
cd dashboard
npm install
npm run test
npm run build
```

Production deployment uses `dashboard/deploy.sh`, rsync backup, and systemd restart. Runtime env lives in `/opt/cortexos/secrets/dashboard.env`.

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
