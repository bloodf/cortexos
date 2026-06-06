# CortexOS Tool Catalog

> Every tool you can install with CortexOS, what it does, and where to learn more.

Think of this as the app store for your server. Each tool is installed by running an AI-driven prompt — a guided conversation that checks your system, asks the right questions, and sets everything up for you. No copy-pasting bash scripts from random wikis.

---

## Quick Overview

| Name | Category | What It Does | Install Prompt | External Links |
|------|----------|--------------|----------------|----------------|
| **tmux** | Core Infrastructure | Keeps terminal sessions alive even if you disconnect | [`prompts/tools/09-tmux.md`](../prompts/tools/09-tmux.md) | [GitHub](https://github.com/tmux/tmux), [Website](https://tmux.github.io) |
| **OS Hardening** | Core Infrastructure | Locks down your server with baseline security rules | [`prompts/tools/10-os-hardening.md`](../prompts/tools/10-os-hardening.md) | — |
| **Docker** | Core Infrastructure | Runs apps in lightweight, isolated containers | [`prompts/tools/11-docker.md`](../prompts/tools/11-docker.md) | [Docs](https://docs.docker.com), [GitHub](https://github.com/docker/docker-ce) |
| **Caddy** | Core Infrastructure | Reverse proxy — routes web traffic to the right app | [`prompts/tools/13-caddy.md`](../prompts/tools/13-caddy.md) | [Website](https://caddyserver.com), [GitHub](https://github.com/caddyserver/caddy) |
| **PostgreSQL** | Databases | Primary relational database — structured data with strict rules | [`prompts/tools/14-postgresql.md`](../prompts/tools/14-postgresql.md) | [Website](https://postgresql.org), [GitHub](https://github.com/postgres/postgres) |
| **Redis** | Databases | Super-fast in-memory store for caching and user sessions | [`prompts/tools/15-redis.md`](../prompts/tools/15-redis.md) | [Website](https://redis.io), [GitHub](https://github.com/redis/redis) |
| **MongoDB** | Databases | Flexible document store for JSON-like data (optional) | [`prompts/tools/16-mongodb.md`](../prompts/tools/16-mongodb.md) | [Website](https://mongodb.com), [GitHub](https://github.com/mongodb/mongo) |
| **MySQL** | Databases | Popular relational database, familiar to many developers (optional) | [`prompts/tools/16a-mysql.md`](../prompts/tools/16a-mysql.md) | [Website](https://mysql.com), [GitHub](https://github.com/mysql/mysql-server) |
| **Prometheus** | Observability | Collects numeric metrics — "how busy is my CPU?" | [`prompts/tools/20-prometheus.md`](../prompts/tools/20-prometheus.md) | [Website](https://prometheus.io), [GitHub](https://github.com/prometheus/prometheus) |
| **Loki** | Observability | Gathers and indexes logs from all your services | [`prompts/tools/21-loki.md`](../prompts/tools/21-loki.md) | [Website](https://grafana.com/oss/loki), [GitHub](https://github.com/grafana/loki) |
| **Grafana** | Observability | Beautiful dashboards that visualize your metrics and logs | [`prompts/tools/22-grafana.md`](../prompts/tools/22-grafana.md) | [Website](https://grafana.com), [GitHub](https://github.com/grafana/grafana) |
| **Fluent Bit** | Observability | Lightweight log forwarder — ships journald logs to Loki | [`prompts/tools/23-fluent-bit.md`](../prompts/tools/23-fluent-bit.md) | [Website](https://fluentbit.io), [GitHub](https://github.com/fluent/fluent-bit) |
| **cAdvisor** | Observability | Container metrics — how much RAM is Docker using? | [`prompts/tools/24-cadvisor.md`](../prompts/tools/24-cadvisor.md) | [GitHub](https://github.com/google/cadvisor) |
| **Node Exporter** | Observability | Host metrics — CPU, disk, network stats from the OS | [`prompts/tools/25-node-exporter.md`](../prompts/tools/25-node-exporter.md) | [GitHub](https://github.com/prometheus/node_exporter) |
| **DB Exporters** | Observability | Database health metrics for Prometheus | [`prompts/tools/28-db-exporters.md`](../prompts/tools/28-db-exporters.md) | — |
| **9Router** | AI & Agents | AI model gateway — one API endpoint for many LLM providers | [`prompts/tools/31-9router.md`](../prompts/tools/31-9router.md) | *Internal CortexOS component* |
| **Hermes WebUI** | AI & Agents | Web interface for managing AI agents | [`prompts/tools/30-hermes-webui.md`](../prompts/tools/30-hermes-webui.md) | [GitHub](https://github.com/nesquena/hermes-webui) |
| **Honcho** | AI & Agents | Memory and knowledge backend for AI agents | [`prompts/tools/32-honcho.md`](../prompts/tools/32-honcho.md) | [GitHub](https://github.com/plastic-labs/honcho) |
| **Hermes Memory OS** | AI & Agents | Long-term memory system (Qdrant vector DB + ARQ worker) | [`prompts/tools/33-hermes-memory-os.md`](../prompts/tools/33-hermes-memory-os.md) | [GitHub](https://github.com/ClaudioDrews/memory-os) |
| **Cortex Sandbox** | AI & Agents | Trusted local sandbox for running untrusted code safely | [`prompts/tools/47a-cortex-sandbox.md`](../prompts/tools/47a-cortex-sandbox.md) | *Internal CortexOS component* |
| **Obot** | AI & Agents | MCP (Model Context Protocol) gateway platform | [`prompts/tools/50-obot.md`](../prompts/tools/50-obot.md) | *Internal CortexOS component* |
| **fzf** | Developer Experience | Fuzzy finder — find files, commands, and history with fuzzy typing | [`prompts/tools/30b-fzf.md`](../prompts/tools/30b-fzf.md) | [GitHub](https://github.com/junegunn/fzf) |
| **BoxBox** | Developer Experience | Terminal-based file manager | [`prompts/tools/30c-boxbox.md`](../prompts/tools/30c-boxbox.md) | [GitHub](https://github.com/jR4dh3y/BoxBox) |
| **pgAdmin** | Admin UIs | Web-based PostgreSQL administration panel | [`prompts/tools/56-pgadmin.md`](../prompts/tools/56-pgadmin.md) | [Website](https://pgadmin.org), [GitHub](https://github.com/postgres/pgadmin4) |
| **RedisInsight** | Admin UIs | Web-based Redis browser and admin tool | [`prompts/tools/57-redisinsight.md`](../prompts/tools/57-redisinsight.md) | [Website](https://redis.io/insight), [GitHub](https://github.com/RedisInsight/RedisInsight) |
| **Mongo Express** | Admin UIs | Web-based MongoDB admin interface | [`prompts/tools/58-mongo-express.md`](../prompts/tools/58-mongo-express.md) | [GitHub](https://github.com/mongo-express/mongo-express) |
| **phpMyAdmin** | Admin UIs | Web-based MySQL/MariaDB administration (classic) | [`prompts/tools/59-phpmyadmin.md`](../prompts/tools/59-phpmyadmin.md) | [Website](https://phpmyadmin.net), [GitHub](https://github.com/phpmyadmin/phpmyadmin) |
| **Incus Project** | Project Tools | Per-project containers with built-in Hermes agent | [`prompts/tools/60-incus-project.md`](../prompts/tools/60-incus-project.md) | [Website](https://linuxcontainers.org/incus), [GitHub](https://github.com/lxc/incus) |
| **CortexOS Dashboard** | Platform Services | SvelteKit web control panel for managing your server (PAM auth) | [`prompts/tools/70-dashboard.md`](../prompts/tools/70-dashboard.md) | *Internal CortexOS component* |
| **Mail Guardian** | Platform Services | IMAP spam triage — keeps your inbox clean automatically | [`prompts/tools/82-mail-guardian.md`](../prompts/tools/82-mail-guardian.md) | *Internal CortexOS component* |

---

## Core Infrastructure (must-haves)

These four are the foundation. Install them first, in order.

### tmux — Terminal Session Persistence

**What it is:** A "screen saver" for your terminal sessions.

**What it does for you:** If your SSH connection drops, your running commands keep going. You can also split one terminal into multiple panes and windows, like having several monitors inside one screen.

- **Install prompt:** [`prompts/tools/09-tmux.md`](../prompts/tools/09-tmux.md)
- **Links:** [GitHub](https://github.com/tmux/tmux) · [Website](https://tmux.github.io)

---

### OS Hardening — Baseline Security

**What it is:** A security checklist enforced on your server.

**What it does for you:** Disables unnecessary services, configures firewall rules (UFW), sets up automatic security updates, and applies SSH hardening (key-only auth, no root login). Think of it as locking all the doors and windows before you move in.

- **Install prompt:** [`prompts/tools/10-os-hardening.md`](../prompts/tools/10-os-hardening.md)

---

### Docker — Container Runtime

**What it is:** A shipping container system for software.

**What it does for you:** Each app runs in its own isolated box with exactly what it needs — no "it works on my machine" problems. Docker Compose (included) lets you define multi-app setups in a single file.

- **Install prompt:** [`prompts/tools/11-docker.md`](../prompts/tools/11-docker.md)
- **Links:** [Docs](https://docs.docker.com) · [GitHub](https://github.com/docker/docker-ce)

---

### Caddy — Reverse Proxy

**What it is:** A smart traffic director for web requests.

**What it does for you:** When someone visits `your-server.com/app1`, Caddy routes them to the right Docker container. It automatically handles HTTPS certificates (via Let's Encrypt) and ties everything to your Tailscale domain. No subdomain juggling.

- **Install prompt:** [`prompts/tools/13-caddy.md`](../prompts/tools/13-caddy.md)
- **Links:** [Website](https://caddyserver.com) · [GitHub](https://github.com/caddyserver/caddy)

---

## Databases

### PostgreSQL — Primary Relational Database

**What it is:** The gold-standard structured database.

**What it does for you:** Stores data in tables with strict rules (schemas), supports complex queries, and guarantees data integrity. Perfect for user accounts, financial data, or anything where structure matters. Think Excel with superpowers and zero tolerance for messy data.

- **Install prompt:** [`prompts/tools/14-postgresql.md`](../prompts/tools/14-postgresql.md)
- **Links:** [Website](https://postgresql.org) · [GitHub](https://github.com/postgres/postgres)

---

### Redis — Cache and Sessions

**What it is:** A lightning-fast scratchpad that lives in memory (RAM).

**What it does for you:** Caches frequently accessed data so apps don't hammer the database. Also stores user session tokens ("who is logged in right now?"). Data can be set to expire automatically — great for temporary stuff.

- **Install prompt:** [`prompts/tools/15-redis.md`](../prompts/tools/15-redis.md)
- **Links:** [Website](https://redis.io) · [GitHub](https://github.com/redis/redis)

---

### MongoDB — Document Store (optional)

**What it is:** A flexible database for JSON-like documents.

**What it does for you:** When your data shape changes often or doesn't fit neat tables, MongoDB lets you store documents (like `{name: "Alice", tags: ["dev", "admin"]}`) without predefining a rigid structure. Optional — only install if you need it.

- **Install prompt:** [`prompts/tools/16-mongodb.md`](../prompts/tools/16-mongodb.md)
- **Links:** [Website](https://mongodb.com) · [GitHub](https://github.com/mongodb/mongo)

---

### MySQL — Relational Database (optional)

**What it is:** The world's most popular open-source relational database.

**What it does for you:** Similar to PostgreSQL — structured tables, SQL queries, strong consistency. Choose this if you're migrating an existing app or your team already knows MySQL. Optional — PostgreSQL is the CortexOS default.

- **Install prompt:** [`prompts/tools/16a-mysql.md`](../prompts/tools/16a-mysql.md)
- **Links:** [Website](https://mysql.com) · [GitHub](https://github.com/mysql/mysql-server)

---

## Observability (Monitoring)

Observability = "can you see what's happening inside your system?" These tools are like the dashboard, security cameras, and black box of an airplane.

### Prometheus — Metrics Collection

**What it is:** A numeric data scraper and time-series database.

**What it does for you:** Every few seconds, Prometheus asks your services "how are you doing?" and stores the answers (CPU %, request latency, error rates) as timestamps. Later you can query: "show me CPU usage between 2pm and 3pm yesterday."

- **Install prompt:** [`prompts/tools/20-prometheus.md`](../prompts/tools/20-prometheus.md)
- **Links:** [Website](https://prometheus.io) · [GitHub](https://github.com/prometheus/prometheus)

---

### Loki — Log Aggregation

**What it is:** A search engine for log files.

**What it does for you:** Every app writes logs ("user logged in", "database connection failed"). Loki gathers them from all containers and hosts, indexes them by labels, and lets you search with queries like `{app="api"} |= "error"`.

- **Install prompt:** [`prompts/tools/21-loki.md`](../prompts/tools/21-loki.md)
- **Links:** [Website](https://grafana.com/oss/loki) · [GitHub](https://github.com/grafana/loki)

---

### Grafana — Dashboards

**What it is:** A visualization layer for your metrics and logs.

**What it does for you:** Turns raw numbers into graphs, heatmaps, and tables. You can build a single pane of glass showing server health, AI model response times, database query performance, and more. Alerts can ping you when things go wrong.

- **Install prompt:** [`prompts/tools/22-grafana.md`](../prompts/tools/22-grafana.md)
- **Links:** [Website](https://grafana.com) · [GitHub](https://github.com/grafana/grafana)

---

### Fluent Bit — Log Forwarding

**What it is:** A lightweight log courier.

**What it does for you:** The Linux system journal (`journald`) produces logs. Fluent Bit reads them, adds labels, and ships them to Loki. It's like a mailroom that sorts and delivers letters to the right department.

- **Install prompt:** [`prompts/tools/23-fluent-bit.md`](../prompts/tools/23-fluent-bit.md)
- **Links:** [Website](https://fluentbit.io) · [GitHub](https://github.com/fluent/fluent-bit)

---

### cAdvisor — Container Metrics

**What it is:** A health monitor specifically for Docker containers.

**What it does for you:** Tracks per-container resource usage — CPU, memory, disk I/O, network. Answers: "Is my Postgres container eating all the RAM?" (cAdvisor = Container Advisor)

- **Install prompt:** [`prompts/tools/24-cadvisor.md`](../prompts/tools/24-cadvisor.md)
- **Links:** [GitHub](https://github.com/google/cadvisor)

---

### Node Exporter — Host Metrics

**What it is:** A hardware vital-signs sensor for your server.

**What it does for you:** Exports low-level OS metrics: CPU load, disk space, filesystem usage, network throughput, memory pressure. Feeds Prometheus so you can alert before the disk fills up.

- **Install prompt:** [`prompts/tools/25-node-exporter.md`](../prompts/tools/25-node-exporter.md)
- **Links:** [GitHub](https://github.com/prometheus/node_exporter)

---

### DB Exporters — Database Metrics

**What it is:** Adapters that translate database health into Prometheus metrics.

**What it does for you:** Exporters for PostgreSQL, Redis, MongoDB, and MySQL expose query performance, connection counts, replication lag, and cache hit ratios. Combined with Grafana alerts, you know about database issues before users complain.

- **Install prompt:** [`prompts/tools/28-db-exporters.md`](../prompts/tools/28-db-exporters.md)

---

## AI & Agents

### 9Router — AI Model Gateway

**What it is:** CortexOS's internal traffic router for AI models.

**What it does for you:** Instead of hardcoding OpenAI, Anthropic, or Gemini APIs in every app, you call 9Router's single OpenAI-compatible endpoint. It routes to the best available model, handles failover, and lets you swap providers without changing code.

- **Install prompt:** [`prompts/tools/31-9router.md`](../prompts/tools/31-9router.md)
- **Links:** *Internal CortexOS component*

---

### Hermes WebUI — Agent Operator UI

**What it is:** A web control panel for AI agents.

**What it does for you:** Start, stop, and monitor AI agent processes. View agent logs, configure prompts, and manage agent state through a browser instead of SSH commands.

- **Install prompt:** [`prompts/tools/30-hermes-webui.md`](../prompts/tools/30-hermes-webui.md)
- **Links:** [GitHub](https://github.com/nesquena/hermes-webui)

---

### Honcho — Memory + Knowledge Backend

**What it is:** A context and memory layer for AI agents.

**What it does for you:** Gives agents long-term memory ("remember that user prefers dark mode") and knowledge retrieval ("look up the API docs for this error"). Agents become stateful and personalized instead of forgetful.

- **Install prompt:** [`prompts/tools/32-honcho.md`](../prompts/tools/32-honcho.md)
- **Links:** [GitHub](https://github.com/plastic-labs/honcho)

---

### Hermes Memory OS — Long-Term Memory

**What it is:** A vector-memory system for agents.

**What it does for you:** Stores agent memories as vector embeddings (semantic fingerprints) in Qdrant, with an ARQ worker for background processing. Enables agents to recall past conversations, learn preferences, and retrieve relevant context by meaning, not just keywords.

- **Install prompt:** [`prompts/tools/33-hermes-memory-os.md`](../prompts/tools/33-hermes-memory-os.md)
- **Links:** [GitHub](https://github.com/ClaudioDrews/memory-os)

---

### Cortex Sandbox — Trusted Code Sandbox

**What it is:** A secure playground for running untrusted code.

**What it does for you:** AI agents sometimes need to execute generated scripts. The sandbox uses gVisor (a user-space kernel) to isolate that code so it can't harm your host system. Think of it as a bomb disposal chamber for Python scripts.

- **Install prompt:** [`prompts/tools/47a-cortex-sandbox.md`](../prompts/tools/47a-cortex-sandbox.md)
- **Links:** *Internal CortexOS component*

---

### Obot — MCP Gateway Platform

**What it is:** A gateway for the Model Context Protocol (MCP).

**What it does for you:** MCP is an open standard that lets AI models securely connect to external tools (databases, APIs, file systems). Obot is the CortexOS implementation — it registers available tools, handles authentication, and routes tool calls between agents and services.

- **Install prompt:** [`prompts/tools/50-obot.md`](../prompts/tools/50-obot.md)
- **Links:** *Internal CortexOS component*

---

## Developer Experience

### fzf — Fuzzy Finder

**What it is:** A search tool that forgives typos.

**What it does for you:** Press a key combo and start typing. `fzf` finds matching files, commands from history, git branches, or process IDs — even if you misspell things. Type `api` and it finds `user-api-controller.ts`. It's like Spotlight for your terminal.

- **Install prompt:** [`prompts/tools/30b-fzf.md`](../prompts/tools/30b-fzf.md)
- **Links:** [GitHub](https://github.com/junegunn/fzf)

---

### BoxBox — File Manager

**What it is:** A terminal-based file explorer with a UI.

**What it does for you:** Navigate directories, preview files, and manage your filesystem without leaving the terminal. Think of it as `ls` and `cd` with a visual interface and keyboard shortcuts.

- **Install prompt:** [`prompts/tools/30c-boxbox.md`](../prompts/tools/30c-boxbox.md)
- **Links:** [GitHub](https://github.com/jR4dh3y/BoxBox)

---

## Admin UIs

These are web-based database management tools. They run as Docker containers behind Caddy, so you access them via your Tailscale domain.

### pgAdmin — PostgreSQL Admin

**What it is:** The official web GUI for PostgreSQL.

**What it does for you:** Browse tables, run SQL queries, manage users and permissions, back up databases, and view query performance — all through a browser. No `psql` command-line required.

- **Install prompt:** [`prompts/tools/56-pgadmin.md`](../prompts/tools/56-pgadmin.md)
- **Links:** [Website](https://pgadmin.org) · [GitHub](https://github.com/postgres/pgadmin4)

---

### RedisInsight — Redis Admin

**What it is:** Redis's official visual browser and profiler.

**What it does for you:** Inspect keys, view data structures (strings, hashes, lists, streams), analyze slow queries, and monitor memory usage in real time. A must-have when debugging cache issues.

- **Install prompt:** [`prompts/tools/57-redisinsight.md`](../prompts/tools/57-redisinsight.md)
- **Links:** [Website](https://redis.io/insight) · [GitHub](https://github.com/RedisInsight/RedisInsight)

---

### Mongo Express — MongoDB Admin

**What it is:** A lightweight web admin panel for MongoDB.

**What it does for you:** Browse collections, view documents, run queries, and export data through a clean web interface. Much friendlier than the `mongo` shell for quick inspections.

- **Install prompt:** [`prompts/tools/58-mongo-express.md`](../prompts/tools/58-mongo-express.md)
- **Links:** [GitHub](https://github.com/mongo-express/mongo-express)

---

### phpMyAdmin — MySQL Admin

**What it is:** The classic web interface for MySQL and MariaDB.

**What it does for you:** Manage databases, tables, users, and run SQL through a familiar point-and-click interface. Been around for 20+ years — if you've used shared hosting, you've probably seen it.

- **Install prompt:** [`prompts/tools/59-phpmyadmin.md`](../prompts/tools/59-phpmyadmin.md)
- **Links:** [Website](https://phpmyadmin.net) · [GitHub](https://github.com/phpmyadmin/phpmyadmin)

---

## Project Tools

### Incus Project — Per-Project Containers with Hermes Agent

**What it is:** Lightweight system containers for isolated project environments.

**What it does for you:** Creates a dedicated container for each project with networking, storage, and a built-in Hermes AI agent. Like Docker but closer to full Linux VMs — great when you need systemd, multiple services, or kernel-level isolation per project.

- **Install prompt:** [`prompts/tools/60-incus-project.md`](../prompts/tools/60-incus-project.md)
- **Links:** [Website](https://linuxcontainers.org/incus) · [GitHub](https://github.com/lxc/incus)

---

## Platform Services

### CortexOS Dashboard — Web Control Panel

**What it is:** Your server's homepage.

**What it does for you:** A SvelteKit 5 web app (authenticates via PAM/Linux users) that shows system status, running services, resource usage, and quick actions. Control your server from a browser instead of memorizing SSH commands.

- **Install prompt:** [`prompts/tools/70-dashboard.md`](../prompts/tools/70-dashboard.md)
- **Links:** *Internal CortexOS component*

---

### Mail Guardian — IMAP Spam Triage

**What it is:** An AI-powered email bouncer.

**What it does for you:** Connects to your IMAP inbox, reads incoming mail, and classifies spam/junk using AI rules. Keeps your inbox clean without sending your data to third-party email services.

- **Install prompt:** [`prompts/tools/82-mail-guardian.md`](../prompts/tools/82-mail-guardian.md)
- **Links:** *Internal CortexOS component*

---

## Planned (Coming Soon)

> **These tools are referenced in CortexOS planning but do not yet have install prompts.**

All tools listed in the sections above have working install prompts and can be installed today. There are currently no additional tools in the "planned without prompts" state.

If a tool you need is missing, check the [roadmap](../.mavis/plans/) or open a feature request in the [GitHub Issues](https://github.com/bloodf/cortexos/issues).
