# Dashboard Revamp — Native-first Service Policy

## Operator decision

CortexOS is native-first. Docker is allowed only when it is the best operational boundary, not as the default packaging format.

## Packaging policy

### Prefer native/systemd

Use host packages, upstream binaries, cloned source + service units, or Homebrew when the service is a process that benefits from direct host integration:

- agent/control-plane processes
- API services
- CLIs and bridges
- telemetry exporters with distro packages
- media/home services with official host install paths
- tools that need host filesystem, terminal, browser, or local agent access

### Allow Docker

Use Docker for:

- databases and state backends where upstream image is canonical or distro packaging is poor
- dashboard app image, because current deployment contract already uses it
- isolation services where container boundary is the feature
- OpenClaw only if upstream native install is unavailable or materially worse
- Langfuse stack until a supported native install path exists; it requires ClickHouse + object storage + worker/web coordination

### Explicit decisions

| Component | Target mode | Reason |
|---|---|---|
| PostgreSQL | native apt | Already native; DB engine. |
| Redis | native apt | Simple host cache/queue; no Docker needed. |
| NATS | native binary/systemd | Single Go daemon + JetStream dir; host service simpler. |
| Paperclip | native source/systemd | Upstream Node app/CLI; should run as machine process. |
| cortex-paperclip-bridge | native Node/systemd | Repo service; no container. Existing template already exists. |
| cortex-graph | native Python/systemd | API process; direct host service. |
| cortex-sandbox-runner | container allowed | Isolation boundary is its purpose; keep container/podman/runsc. |
| AgentGateway | native Node/systemd | API process; direct host service. |
| Dashboard | Docker allowed | Existing dashboard deploy contract. |
| Prometheus | native apt/binary/systemd | Single daemon; native data dir. |
| Grafana | native apt/systemd | Official apt repo; native service. |
| Loki | native binary/systemd | Single daemon; native data dir. |
| Fluent Bit | native apt/systemd | Host log collector. |
| node-exporter | native apt/binary/systemd | Host metrics exporter. |
| cAdvisor | Docker allowed | Container metrics require Docker FS/cgroups. |
| kernel-browser | Docker allowed | Browser isolation. |
| Langfuse | Docker allowed | Multi-component upstream deploy; revisit later. |
| pgAdmin | native Python venv/systemd | Web app; can run host-local. |
| RedisInsight | Docker allowed unless upstream native Linux package exists | Redis publishes container/AppImage-style distribution; keep direct-IP only if no stable host package. |
| MongoDB | native apt when installed | DB engine; official repo. |
| mongo-express | native npm/systemd | Node web UI. |
| MySQL | native apt when installed | DB engine. |
| phpMyAdmin | native apt | PHP web app package. |
| Watchtower | remove | Docker auto-update conflicts with native-first; replace with update-check script. |
| pg-exporter | native binary/systemd | Exporter process. |
| redis-exporter | native binary/systemd | Exporter process. |
| Home Assistant | native venv/systemd or supervised install | Host service, not container by default. |
| Jellyfin | native apt/systemd | Official apt repo. |

## Immediate remediation done

Stopped the incorrectly started containers:

- cortex-paperclip-bridge
- cortex-watchtower
- cortex-pgadmin
- cortex-redisinsight
- cortex-mongodb
- cortex-mongo-express
- cortex-mysql
- cortex-phpmyadmin
- cortex-pg-exporter
- cortex-redis-exporter

Kept existing accepted containers:

- cortex-dashboard
- langfuse stack
- cortex-sandbox-runner
- kernel-browser
- cadvisor

## Revised next phases

1. Convert already-containerized core services where safe: Redis, NATS, Prometheus/Grafana/Loki/Fluent Bit/node-exporter, AgentGateway, cortex-graph.
2. Install Paperclip from upstream native docs/source, not Docker.
3. Install optional DB engines natively if requested: MongoDB, MySQL.
4. Install web DB admins natively where supported: pgAdmin venv, mongo-express npm service, phpMyAdmin apt. RedisInsight remains Docker only if no official native Linux install is available.
5. Replace Watchtower with `scripts/cortex-update-check.sh` + optional systemd timer; no automatic container mutation.
6. Update prompts so every spoke declares `Install mode: native|docker-allowed` and explains exceptions.
7. Keep dashboard UI work after host packaging policy is corrected.
