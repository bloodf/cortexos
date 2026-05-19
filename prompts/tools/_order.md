# Spoke Dependency Graph

Declarative dependency map for `prompts/tools/`. Each spoke lists its required predecessors.
SETUP.md reads this file to compute install order and skip disabled optional spokes.

```yaml
spokes:
  00-preflight:
    deps: []
    optional: false

  10-os-hardening:
    deps: [00-preflight]
    optional: false

  11-docker:
    deps: [10-os-hardening]
    optional: false

  12-tailscale:
    deps: [11-docker]
    optional: false

  12a-sops-bootstrap:
    deps: [12-tailscale]
    optional: false       # SOPS + age must be available before any service
                          # that loads secrets — install before Caddy.

  13-caddy:
    deps: [12-tailscale, 12a-sops-bootstrap]
    optional: false

  14-postgresql:
    deps: [10-os-hardening]
    optional: false

  15-redis:
    deps: [11-docker]
    optional: false

  16-mongodb:
    deps: [11-docker]
    optional: true       # enabled only if questionnaire: mongodb=yes


  16a-mysql:
    deps: [11-docker]
    optional: true       # enabled only if questionnaire: INSTALL_MYSQL=yes
  17-dnsmasq:
    deps: [10-os-hardening]
    optional: false

  18-fail2ban:
    deps: [10-os-hardening, 17-dnsmasq]
    optional: false

  20-prometheus:
    deps: [11-docker, 13-caddy]
    optional: false

  21-loki:
    deps: [20-prometheus]
    optional: false

  22-grafana:
    deps: [20-prometheus, 21-loki]
    optional: false

  23-fluent-bit:
    deps: [21-loki]
    optional: false

  24-cadvisor:
    deps: [20-prometheus]
    optional: false

  25-node-exporter:
    deps: [20-prometheus]
    optional: false

  30-nats:
    deps: [11-docker]
    optional: false

  31-9router:
    deps: [30-nats]
    optional: false

  32-openviking:
    deps: [14-postgresql, 31-9router, 30-nats]
    optional: false

  33-leann:
    deps: [32-openviking, 31-9router]
    optional: false

  34-kernel-browser:
    deps: [11-docker, 31-9router]
    optional: false

  40-openclaw:
    deps: [31-9router, 32-openviking]
    optional: false

  41-openclaw-channels:
    deps: [40-openclaw]
    optional: false    # all four channels mandatory for v1.0

  42-openclaw-openviking:
    deps: [40-openclaw, 32-openviking]
    optional: false

  43-openclaw-memory-core:
    deps: [42-openclaw-openviking]
    optional: false

  44-openclaw-a2a-gateway:
    deps: [40-openclaw]
    optional: false

  45-openclaw-compaction:
    deps: [40-openclaw]
    optional: false

  45a-cortex-graph:
    deps: [14-postgresql, 30-nats, 45-openclaw-compaction]
    optional: false      # LangGraph sidecar (V7 substrate)

  46-openclaw-codex-watchdog:
    deps: [40-openclaw, 30-nats]
    optional: false

  47-openclaw-foundry:
    deps: [40-openclaw]
    optional: false

  47a-cortex-sandbox:
    deps: [11-docker, 12a-sops-bootstrap, 47-openclaw-foundry]
    optional: false      # gVisor sandbox runner (V10 substrate)

  49-openclaw-account-ops:
    deps: [40-openclaw, 47a-cortex-sandbox]
    optional: false

  50-agentgateway:
    deps: [40-openclaw, 30-nats, 14-postgresql]
    optional: false

  55-langfuse:
    deps: [14-postgresql, 11-docker, 50-agentgateway]
    optional: false      # full Langfuse operator install + OpenLLMetry wiring


  56-pgadmin:
    deps: [14-postgresql]
    optional: true       # enabled only if INSTALL_PGADMIN=yes

  57-redisinsight:
    deps: [15-redis]
    optional: true       # enabled only if INSTALL_REDISINSIGHT=yes

  58-mongo-express:
    deps: [16-mongodb]
    optional: true       # enabled only if INSTALL_MONGO_EXPRESS=yes

  59-phpmyadmin:
    deps: [16a-mysql]
    optional: true       # enabled only if INSTALL_PHPMYADMIN=yes
  60-cortex-consumer:
    deps: [30-nats, 40-openclaw, 50-agentgateway, 55-langfuse]
    optional: false

  61-weekly-synthetic-traffic:
    deps: [60-cortex-consumer]
    optional: false

  70-dashboard:
    deps: [14-postgresql, 13-caddy, 40-openclaw]
    optional: false

  80-agent-factory:
    deps: [70-dashboard]
    optional: false

  81-projects:
    deps: [70-dashboard]
    optional: false

  99-final-validation:
    deps:
      - 18-fail2ban
      - 22-grafana
      - 23-fluent-bit
      - 24-cadvisor
      - 25-node-exporter
      - 33-leann
      - 34-kernel-browser
      - 43-openclaw-memory-core
      - 44-openclaw-a2a-gateway
      - 45-openclaw-compaction
      - 46-openclaw-codex-watchdog
      - 47-openclaw-foundry
      - 47a-cortex-sandbox
      - 49-openclaw-account-ops
      - 50-agentgateway
      - 55-langfuse
      - 60-cortex-consumer
      - 61-weekly-synthetic-traffic
      - 70-dashboard
      - 80-agent-factory
      - 81-projects
      - 12a-sops-bootstrap
      - 45a-cortex-graph
    optional: false
```

## Notes

- Agent computes topological sort of enabled spokes before execution.
- Optional spokes are skipped unless the questionnaire enabled them.
- `16-mongodb` is optional (questionnaire-gated).
- All other spokes are required.
- Spoke numbering has intentional gaps (e.g. 18→20, 35→40) to allow future insertion without renumbering.
