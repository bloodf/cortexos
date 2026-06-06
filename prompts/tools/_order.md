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
31-9router · OpenAI-compatible model router                 # AI gateway
32-honcho · memory + knowledge backend
33-hermes-memory-os · long-term memory (Qdrant + ARQ worker)
47a-cortex-sandbox · trusted local tool sandbox
50-obot · MCP gateway platform
60-incus-project · per-project Incus + Hermes agent        # Per-project
56-pgadmin · PostgreSQL admin UI                           # Operator surfaces
57-redisinsight · Redis admin UI
58-mongo-express · MongoDB admin UI
59-phpmyadmin · MySQL admin UI
70-dashboard · SvelteKit control panel (PAM auth)
82-mail-guardian · IMAP spam triage
