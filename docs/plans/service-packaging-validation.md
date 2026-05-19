# CortexOS Service Packaging Validation

## Final policy

Docker is approved for backing services, DB/admin UIs, and selected CortexOS services that do not need direct host process semantics. Native/systemd is reserved for local agent runtimes, host-integrated tools, Paperclip bridge, and services where host access/debuggability is the point.

## Docker/container-approved

| Service | Mode | Rationale |
|---|---|---|
| PostgreSQL | Docker | User confirmed DBs are containers; current native DB has no important data and can be removed after secrets update. |
| Redis | Docker | User confirmed Redis container. |
| MySQL | Docker | User confirmed DB container. |
| MongoDB | Docker | User confirmed DB container. |
| pgAdmin | Docker | User confirmed DB admin UI container. |
| RedisInsight | Docker | User confirmed Redis admin UI container. |
| mongo-express | Docker | User confirmed Mongo admin UI container. |
| phpMyAdmin | Docker | User confirmed MySQL admin UI container. |
| pg-exporter | Docker | User confirmed DB exporter container. |
| redis-exporter | Docker | User confirmed DB exporter container. |
| Dashboard | Docker | Current deployment contract uses dashboard container. |
| Langfuse | Docker | User confirmed Langfuse can be container. Current multi-container stack acceptable. |
| NATS | Docker | User confirmed NATS can be container. Existing compose acceptable with named volume. |
| cortex-consumer | Docker allowed | User confirmed container acceptable. Current native systemd may remain until clean cutover. |
| cortex-graph | Docker | User confirmed graph can be container. Existing compose acceptable. |
| OpenViking | Docker allowed | User confirmed container acceptable, though current install is native. Do not force native. |
| cortex-sandbox-runner | Docker | Isolation boundary is product behavior. |
| kernel-browser | Docker | Browser isolation. |
| cAdvisor | Docker | Container/cgroup metrics. |
| Watchtower | Docker | Keep for Docker image updates only; native packages, applications, and libraries are handled by update-check script/timer. |

## Native/systemd-required

| Service | Mode | Rationale |
|---|---|---|
| Paperclip | Native | Upstream CLI/onboard install; host agent workflow. |
| cortex-paperclip-bridge | Native systemd | First-party webhook/worker; template systemd unit exists. |
| AgentGateway | Native systemd | User excluded from container-allowed list; host tool broker. |
| LEANN | Native systemd | User excluded from container-allowed list; current prompt already native. |
| OpenClaw gateway | Native systemd | Host agent gateway. |
| 9Router | Native systemd | Host LLM router. |

## Live state guidance

Allowed live containers:

- `cortex-dashboard`
- `cortex-langfuse-*`
- `nats-nats-1`
- `cortex-graph`
- `redis-redis-1`
- `cortex-sandbox-runner`
- `kernel-browser-kernel-browser-1`
- monitoring containers unless later split

Must be corrected:

- `cortex-agentgateway` container → replace with native systemd.
- Missing DB/admin/exporter containers → create/start approved stacks.
- Native `postgresql.service` → remove after Postgres container + dashboard secrets cutover. User confirmed no important DB data.
- `cortex-consumer.service` native → may remain temporarily; prompts should allow container if final deployment chooses container.

## Prompt updates required

1. `14-postgresql.md`: rewrite to Docker Postgres with named volume; update dashboard DB secrets.
2. `15-redis.md`: keep Docker; ensure auth + named volume + secrets are consistent.
3. `16-mongodb.md`: keep Docker; add mongo-express dependent prompt/stack.
4. Add `16a-mysql.md`: Docker MySQL + named volume.
5. Add DB admin/exporter prompts as Docker: pgAdmin, RedisInsight, mongo-express, phpMyAdmin, pg-exporter, redis-exporter.
6. `30-nats.md`: keep Docker; ensure named volume, loopback bind, secrets, `cortex-net` attachment.
7. `45a-cortex-graph.md`: keep Docker; correct host/DB/NATS URLs for containerized Postgres/NATS.
8. `55-langfuse.md`: keep Docker; fix Caddy/direct URL expectations.
9. `50-agentgateway.md`: rewrite native systemd.
10. `prompts/paperclip/20-bridge.md`: remove Compose path; native systemd only.
11. Keep Watchtower stack for Docker image updates only; add update-check script + optional timer for native packages, applications, and libraries.
12. Reconcile `docs/SERVICES.md`, dashboard service catalog, dynamic seed, Caddy routes.
