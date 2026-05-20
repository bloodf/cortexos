# CortexOS Dashboard

> Next.js administration interface for services, credentials, agents, storage, terminal access, and operational health.

## Contents

- [Overview](#overview)
- [Feature map](#feature-map)
- [Local development](#local-development)
- [Production deployment](#production-deployment)
- [API surfaces](#api-surfaces)
- [Security controls](#security-controls)
- [Screenshots](#screenshots)
- [Related docs](#related-docs)

## Overview

Dashboard is a Next.js 16 application in `packages/cortex-dashboard/`. It runs on loopback port 3080 behind Tailscale Serve, uses PostgreSQL for state, and probes local/host services through configured health checks.
The legacy Docker Compose file at `stacks/cortex-dashboard/docker-compose.yml` is deprecated and preserved only for reference.

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
pnpm install
pnpm run test
pnpm run dev          # custom server on PORT=3000
```

## Production deployment

Production runs as a native systemd service from the Next.js standalone build. Docker is not used for the dashboard.

```bash
cd /opt/cortexos/packages/cortex-dashboard
bash scripts/native-build.sh
sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-dashboard.service /etc/systemd/system/cortex-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-dashboard
curl -fsS http://127.0.0.1:3080/api/health
```

Key facts:

- Runtime: `node .next/standalone/server.js` under `cortex-dashboard.service`.
- Runtime env: `/opt/cortexos/.secrets/dashboard.env`.
- Port: loopback `3080`; Tailscale Serve publishes `https://${CORTEX_DOMAIN}/`.
- Migrations: run by `scripts/migrate.js`; dynamic catalog hydration runs via `scripts/dynamic-seed.js`.

See [prompts/tools/70-dashboard.md](../prompts/tools/70-dashboard.md) for the full operator flow.

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
- Path allowlist in `packages/cortex-dashboard/src/lib/secrets/allowlist.ts`.
- Audit logging for reveal, write, and dispatch operations.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
