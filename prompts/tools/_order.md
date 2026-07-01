# Install order — run top to bottom

00-preflight · rebuild prerequisites                       # Foundation
09-tmux · session persistence
10-os-hardening · baseline host security
11-docker · container runtime
13-caddy · tailnet reverse proxy
14-postgresql · primary relational store                    # Databases
15-redis · cache + sessions
16-mongodb · optional document store
16a-mysql · optional relational store
20-prometheus · metrics                                    # Observability
21-loki · log aggregation
22-grafana · metrics + log dashboards
23-fluent-bit · journal → Loki forwarder
24-cadvisor · container metrics
25-node-exporter · host metrics
28-db-exporters · postgres/redis/mongo/mysql metrics
30b-fzf · fuzzy finder
30c-boxbox · file manager
30d-herdr · terminal workspace manager for AI coding agents
30e-headroom · context compression proxy + MCP for AI agents
31-9router · OpenAI-compatible model router                 # AI gateway
32-honcho · memory backend (legacy, read-only)
32b-hindsight · memory backend (Hindsight, primary)
33-hermes-memory-os · long-term memory (Qdrant + ARQ worker)
35a-local-harness-9router · pick 9Router models in your local AI harness
36-hermes-profile-factory · create Hermes agent profile with Hindsight memory
37-firecrawl · self-hosted web crawl/scrape API
47a-cortex-sandbox · trusted local tool sandbox
60-incus-project · per-project Incus + Hermes agent        # Per-project
56-pgadmin · PostgreSQL admin UI                           # Operator surfaces
57-redisinsight · Redis admin UI
58-mongo-express · MongoDB admin UI
59-phpmyadmin · MySQL admin UI
70-dashboard · SvelteKit control panel (PAM auth)
80-ai-harness-skills · shared skill libraries for every coding agent
82-mail-guardian · IMAP spam triage
