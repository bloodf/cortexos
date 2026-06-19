# CortexOS App Catalog

> **What CortexOS installs and why.**
>
> For the complete tool catalog with external links, see [`TOOLS.md`](TOOLS.md).
> For the install order, see [`../prompts/tools/_order.md`](../prompts/tools/_order.md).

---

## Install Order

Run these in order. Each prompt file contains step-by-step instructions you copy into your AI assistant.

| # | App | What It Does |
|---|-----|-------------|
| 00 | [Preflight](../prompts/tools/00-preflight.md) | Check your server is ready |
| 09 | [tmux](../prompts/tools/09-tmux.md) | Keep terminal sessions running |
| 10 | [OS Hardening](../prompts/tools/10-os-hardening.md) | Lock down server security |
| 11 | [Docker](../prompts/tools/11-docker.md) | Run services in containers |
| 13 | [Caddy](../prompts/tools/13-caddy.md) | Web proxy and HTTPS |
| 14 | [PostgreSQL](../prompts/tools/14-postgresql.md) | Main database |
| 15 | [Redis](../prompts/tools/15-redis.md) | Fast cache and sessions |
| 16 | [MongoDB](../prompts/tools/16-mongodb.md) | Document database *(optional)* |
| 16a | [MySQL](../prompts/tools/16a-mysql.md) | Another database *(optional)* |
| 20 | [Prometheus](../prompts/tools/20-prometheus.md) | Collect metrics |
| 21 | [Loki](../prompts/tools/21-loki.md) | Collect logs |
| 22 | [Grafana](../prompts/tools/22-grafana.md) | View dashboards |
| 23 | [Fluent Bit](../prompts/tools/23-fluent-bit.md) | Forward system logs |
| 24 | [cAdvisor](../prompts/tools/24-cadvisor.md) | Monitor containers |
| 25 | [Node Exporter](../prompts/tools/25-node-exporter.md) | Monitor server hardware |
| 28 | [DB Exporters](../prompts/tools/28-db-exporters.md) | Monitor databases |
| 30 | [Hermes WebUI](../prompts/tools/30-hermes-webui.md) | Agent operator interface |
| 30b | [fzf](../prompts/tools/30b-fzf.md) | Fuzzy file/command finder |
| 30c | [BoxBox](../prompts/tools/30c-boxbox.md) | Web file manager |
| 30d | [herdr](../prompts/tools/30d-herdr.md) | Agent terminal workspace manager |
| 30f | [9Remote](../prompts/tools/30f-9remote.md) | Browser remote terminal |
| 31 | [9Router](../prompts/tools/31-9router.md) | AI model gateway |
| 32 | [Honcho](../prompts/tools/32-honcho.md) | AI memory backend (legacy, read-only) |
| 32b | [Hindsight](../prompts/tools/32b-hindsight.md) | AI memory backend (primary) |
| 47a | [Sandbox](../prompts/tools/47a-cortex-sandbox.md) | Safe code execution |
| 50 | [Obot](../prompts/tools/50-obot.md) | MCP gateway |
| 56 | [pgAdmin](../prompts/tools/56-pgadmin.md) | PostgreSQL admin UI *(optional)* |
| 57 | [RedisInsight](../prompts/tools/57-redisinsight.md) | Redis admin UI *(optional)* |
| 58 | [Mongo Express](../prompts/tools/58-mongo-express.md) | MongoDB admin UI *(optional)* |
| 59 | [phpMyAdmin](../prompts/tools/59-phpmyadmin.md) | MySQL admin UI *(optional)* |
| 60 | [Incus Project](../prompts/tools/60-incus-project.md) | Per-project containers |
| 70 | [Dashboard](../prompts/tools/70-dashboard.md) | Web control panel |
| 82 | [Mail Guardian](../prompts/tools/82-mail-guardian.md) | IMAP spam filter *(optional)* |

---

## What's Optional?

You don't need to install everything. Skip any tool you don't need:

- **Databases:** Only install the ones your apps use
- **Admin UIs:** Only if you want web interfaces for databases
- **Mail Guardian:** Only if you use IMAP email

Core infrastructure (tmux, Docker, Caddy, OS hardening) and the Dashboard are recommended for everyone.

---

## Learn More

- **External links for every tool:** [`TOOLS.md`](TOOLS.md)
- **How the installer works:** [`ARCHITECT.md`](ARCHITECT.md)
- **Beginner install guide:** [`INSTALL-WITH-AI.md`](INSTALL-WITH-AI.md)
