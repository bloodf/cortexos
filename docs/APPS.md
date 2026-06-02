# CortexOS App Catalog

This catalog explains what CortexOS installs and why. The canonical install
order lives in `prompts/tools/_order.md`; this document gives operators the
plain-English map before they run the prompts.

## Core AI Runtime

| App | Install prompt | Role |
| --- | --- | --- |
| Paperclip | `62-paperclip.md` | Workflow, issue, approval, run, budget, and audit surface |
| Hermes | `40-hermes.md` | Agent runtime used by every CortexOS profile |
| Hermes profiles | `41-hermes-profiles.md` | Isolated profile homes, env files, identity files, and local APIs |
| Paperclip + Hermes adapter | `43-paperclip-hermes.md` | Connects Paperclip work to Hermes profile execution |
| Honcho | `32-honcho.md` | Memory and knowledge backend |
| Hermes + Honcho | `42-hermes-honcho.md` | Wires each Hermes profile to Honcho workspace memory |
| 9Router | `31-9router.md` | OpenAI-compatible model gateway for all model calls |
| Ollama embeddings proxy | `32-honcho.md` | Local `nomic-embed-text:latest` embeddings for Honcho |
| AgentGateway MCP | `42a-hermes-mcp.md` | Aggregates shared external MCP tools without filesystem access |
| Cortex Agent Factory skill | `80-agent-factory.md` | Lets Cortex Hermes create Paperclip/Hermes-backed agents |

Agent Factory is intentionally not a dashboard feature. Cortex Hermes owns that
workflow through its skill.

## Operator Interfaces

| App | Install prompt | Role |
| --- | --- | --- |
| CortexOS Dashboard | `70-dashboard.md` | Native Next.js control panel for services, health, files, and admin workflows |
| Hermes Web UI | `40-hermes.md` | Operator-facing Hermes profile UI |
| Paperclip UI/API | `62-paperclip.md` | Work tracking and agent execution surface |
| Dockhand/Dockge | `27-dockhand.md` | Docker Compose stack management |

## Host And Network Foundation

| App | Install prompt | Role |
| --- | --- | --- |
| OS hardening | `10-os-hardening.md` | Baseline host security |
| Homebrew for Linux | `09-homebrew.md` | Shared package source for native-first tools |
| Docker Engine | `11-docker.md` | Container runtime for stack services |
| Tailscale | `12-tailscale.md` | Tailnet connectivity |
| Tailscale Serve | `13-tailscale-serve.md` | Tailnet HTTPS routing to loopback services |
| SOPS bootstrap | `12a-sops-bootstrap.md` | Decrypts secrets to `/opt/cortexos/.secrets` safely |
| dnsmasq | `17-dnsmasq.md` | Local DNS support where needed |
| fail2ban | `18-fail2ban.md` | Host abuse protection |

## Databases And Storage

| App | Install prompt | Role |
| --- | --- | --- |
| PostgreSQL | `14-postgresql.md` | Dashboard and service relational data |
| Redis | `15-redis.md` | Cache/session infrastructure |
| MongoDB | `16-mongodb.md` | Optional document database |
| MySQL | `16a-mysql.md` | Optional relational database |

Database admin UIs are optional: pgAdmin, RedisInsight, mongo-express, and
phpMyAdmin.

## Observability

| App | Install prompt | Role |
| --- | --- | --- |
| Prometheus | `20-prometheus.md` | Metrics collection |
| Loki | `21-loki.md` | Log aggregation |
| Grafana | `22-grafana.md` | Metrics and log dashboards |
| Fluent Bit | `23-fluent-bit.md` | Systemd journal forwarding to Loki |
| cAdvisor | `24-cadvisor.md` | Container metrics |
| Node Exporter | `25-node-exporter.md` | Host metrics |
| OpenTelemetry Collector | `26a-otel-collector.md` | OTLP receiver for traces, metrics, and logs |
| Langfuse | `55-langfuse.md` | LLM traces and prompt/model observability |

## Agent Tools

| App | Install prompt | Role |
| --- | --- | --- |
| Kernel Browser | `34-kernel-browser.md` | Headless browser automation for agents |
| Cortex Sandbox Runner | `47a-cortex-sandbox.md` | Isolated execution service for trusted local tools |
| 9Router skills | `42a-hermes-mcp.md` | Chat, image, TTS, STT, embeddings, web search, and web fetch skills |
| Filesystem MCP | `42a-hermes-mcp.md` | Direct project-path access attached to coding Hermes profiles only |
| Memory import prep | `49-memory-import-prep.md` | Preserves old memory material for Honcho import |

AgentGateway must never receive filesystem MCP. Filesystem access is scoped to
the Hermes profile that owns the relevant project path.

## Developer And Emulation Tools

| App | Install prompt | Role |
| --- | --- | --- |
| Floci/LocalStack | `28-floci.md` | Local AWS-compatible service emulation |
| API exposure templates | `44-api-exposure.md` | Loopback and tailnet exposure rules for agent APIs |
| Final validation | `99-final-validation.md` | End-of-install service and repository checks |

## Optional Apps

| App | Install prompt | When to install |
| --- | --- | --- |
| Home Assistant | `14a-home-assistant.md` | Operator wants smart-home integration |
| Jellyfin | `14b-jellyfin.md` | Operator wants media server support |
| pgAdmin | `56-pgadmin.md` | Operator wants PostgreSQL admin UI |
| RedisInsight | `57-redisinsight.md` | Operator wants Redis admin UI |
| mongo-express | `58-mongo-express.md` | Operator wants MongoDB admin UI |
| phpMyAdmin | `59-phpmyadmin.md` | Operator wants MySQL admin UI |
| Private projects | `81-projects.md` | Base machine is healthy and a private project is being onboarded |
| Mail Guardian | `82-mail-guardian.md` | Operator wants IMAP spam review through Cortex-owned automation |

Optional apps must follow the same rules as core apps: ask for values in chat,
keep secrets under `/opt/cortexos/.secrets`, keep seeds public-safe, and avoid
adding alternate agent workflow paths.
