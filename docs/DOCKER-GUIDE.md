# Docker Guide

CortexOS uses Docker Engine and Docker Compose for containerized services.

## Host Services

The dashboard runs as a **systemd unit** (`cortex-dashboard.service`), not a container.
Databases and monitoring stacks run as Docker Compose services under `stacks/`.

## Stacks

| Stack | Path | Purpose |
|-------|------|---------|
| Monitoring | `stacks/` (host services) | Prometheus, Grafana, Loki, Fluent Bit |
| Databases | `stacks/` (host services) | PostgreSQL, MySQL, Redis, MongoDB |

## Common Commands

```bash
# List running containers
docker ps

# View logs
docker logs -f <container>

# Restart a stack
cd /opt/cortexos/stacks/<stack>
docker compose restart

# Pull latest images
docker compose pull && docker compose up -d
```

## Docker Daemon Config

`/etc/docker/daemon.json` is managed by `prompts/tools/11-docker.md`.
It enables:
- `json-file` logging driver
- `live-restore` for zero-downtime daemon restarts

## Security

- Docker socket is **not** exposed to containers.
- Untrusted code runs in Incus containers or the gVisor sandbox.
- The dashboard uses `docker` CLI via the root helper, not direct socket access.
