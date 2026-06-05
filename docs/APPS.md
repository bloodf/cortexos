# CortexOS App Catalog

This catalog explains what CortexOS installs and why. The canonical
install order lives in `prompts/tools/_order.md`; this document is
the operator-facing map.

The catalog is split into two tables:

- **Shipped** — has a real file under `prompts/tools/` and is
  installable today.
- **Planned** — referenced by name elsewhere in the project but
  no `prompts/tools/NN-*.md` file exists yet. Don't follow a
  Planned row as if it were a working installer.

## Shipped (source of truth)

| App | Install prompt | Role |
| --- | --- | --- |
| tmux | `09-tmux.md` | Operator session persistence on the host |
| OS hardening | `10-os-hardening.md` | Baseline host security |
| Docker Engine | `11-docker.md` | Container runtime for stack services |
| Caddy | `13-caddy.md` | Tailnet reverse proxy (Caddyfile snippets per service) |
| PostgreSQL | `14-postgresql.md` | Primary relational store (dashboard + Paperclip) |
| Redis | `15-redis.md` | Cache + session store |
| MongoDB | `16-mongodb.md` | Optional document database |
| MySQL | `16a-mysql.md` | Optional relational database |
| Prometheus | `20-prometheus.md` | Metrics collection |
| Loki | `21-loki.md` | Log aggregation |
| Grafana | `22-grafana.md` | Metrics + log dashboards |
| Fluent Bit | `23-fluent-bit.md` | Systemd journal forwarding to Loki |
| cAdvisor | `24-cadvisor.md` | Container metrics |
| Node Exporter | `25-node-exporter.md` | Host metrics |
| Database exporters | `28-db-exporters.md` | Postgres/Redis/Mongo/MySQL metrics |
| 9Router | `31-9router.md` | OpenAI-compatible model router (shared AI gateway) |
| Honcho | `32-honcho.md` | Memory + knowledge backend |
| Cortex Sandbox Runner | `47a-cortex-sandbox.md` | Trusted local tool sandbox |
| Obot | `50-obot.md` | MCP gateway platform |
| pgAdmin | `56-pgadmin.md` | PostgreSQL admin UI |
| RedisInsight | `57-redisinsight.md` | Redis admin UI |
| mongo-express | `58-mongo-express.md` | MongoDB admin UI |
| phpMyAdmin | `59-phpmyadmin.md` | MySQL admin UI |
| Incus project (per project) | `60-incus-project.md` | Per-project Incus instance with Hermes agent + Tailscale |
| CortexOS Dashboard | `70-dashboard.md` | Native SvelteKit control panel (PAM auth, ports 3080 host / 443 via Caddy) |
| Mail Guardian | `82-mail-guardian.md` | Optional IMAP spam triage through Cortex-owned automation |

The `00-preflight.md` file is the rebuild prerequisite check —
run it before any of the prompts above.

## Planned (no install prompt yet)

These are referenced in the project's roadmap and in the
hermes-fzf-boxbox plan, but the `prompts/tools/NN-*.md` file
has not been written. **Do not** quote one of these as if it
were installable; the row is a name reservation, not a
contract.

| App | Planned for | Notes |
| --- | --- | --- |
| Homebrew for Linux | `09-homebrew.md` | Shared package source for native-first tools |
| Tailscale | `12-tailscale.md` | Tailnet connectivity (Caddy depends on it) |
| SOPS bootstrap | `12a-sops-bootstrap.md` | Decrypts secrets to `/opt/cortexos/.secrets/` |
| Tailscale Serve | `13-tailscale-serve.md` | Tailnet HTTPS routing to loopback services |
| dnsmasq | `17-dnsmasq.md` | Local DNS support where needed |
| fail2ban | `18-fail2ban.md` | Host abuse protection |
| OpenTelemetry Collector | `26a-otel-collector.md` | OTLP receiver for traces, metrics, and logs |
| Dockhand / Dockge | `27-dockhand.md` | Docker Compose stack management |
| Hermes-webui (host) | `30-hermes-webui.md` | Web UI for Hermes; being added by install-new-tools |
| fzf (host + per-instance) | `30a-fzf.md` | CLI fuzzy finder; being added by install-new-tools |
| BoxBox (host) | `30b-boxbox.md` | Web-based file manager; being added by install-new-tools |
| Kernel Browser | `34-kernel-browser.md` | Headless browser automation for agents |
| Hermes runtime | `40-hermes.md` | Agent runtime used by every CortexOS profile |
| Hermes profiles | `41-hermes-profiles.md` | Isolated profile homes, env files, identity files, local APIs |
| Hermes + Honcho | `42-hermes-honcho.md` | Wires each Hermes profile to Honcho workspace memory |
| AgentGateway MCP | `42a-hermes-mcp.md` | Shared external MCP tools (no filesystem access) |
| Paperclip + Hermes adapter | `43-paperclip-hermes.md` | Connects Paperclip work to Hermes profile execution |
| API exposure templates | `44-api-exposure.md` | Loopback + tailnet exposure rules for agent APIs |
| Memory import prep | `49-memory-import-prep.md` | Preserves old memory material for Honcho import |
| Langfuse | `55-langfuse.md` | LLM traces and prompt/model observability |
| Paperclip | `62-paperclip.md` | Workflow, issue, approval, run, budget, audit surface |
| Cortex Agent Factory skill | `80-agent-factory.md` | Lets Cortex Hermes create Paperclip/Hermes-backed agents |
| Private projects | `81-projects.md` | Per-project private workspaces |
| Home Assistant | `14a-home-assistant.md` | Optional: smart-home integration |
| Jellyfin | `14b-jellyfin.md` | Optional: media server support |
| Final validation | `99-final-validation.md` | End-of-install service + repository checks |
| Floci / LocalStack | `28-floci.md` | Local AWS-compatible service emulation |

When a Planned row lands (the install-new-tools task is creating
the 30/30a/30b rows this cycle), move it into the Shipped
table and drop the `Planned for` column.

## Optional apps

The `Shipped` table includes the optional apps already on disk:
`16-mongodb.md`, `16a-mysql.md`, `56-pgadmin.md`,
`57-redisinsight.md`, `58-mongo-express.md`, `59-phpmyadmin.md`,
`82-mail-guardian.md`. Operators install these only when they
need them; the rest of the catalog assumes they are off.

Optional apps follow the same rules as core apps: ask for
values in chat, keep secrets under `/opt/cortexos/.secrets/`,
keep seeds public-safe, avoid adding alternate agent workflow
paths.
