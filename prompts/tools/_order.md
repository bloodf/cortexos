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

  13-caddy:
    deps: [12-tailscale]
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

  35-opik:
    deps: [14-postgresql, 11-docker]
    optional: true       # DEPRECATED — superseded by 35a-langfuse; MySQL-backed

  35a-langfuse:
    deps: [14-postgresql, 11-docker]
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

  46-openclaw-codex-watchdog:
    deps: [40-openclaw, 30-nats]
    optional: false

  47-openclaw-foundry:
    deps: [40-openclaw]
    optional: false

  48-openclaw-opik:
    deps: [40-openclaw, 35-opik]
    optional: false

  49-openclaw-account-ops:
    deps: [40-openclaw]
    optional: false

  50-agentgateway:
    deps: [40-openclaw, 30-nats, 14-postgresql]
    optional: false

  60-cortex-consumer:
    deps: [30-nats, 40-openclaw, 50-agentgateway]
    optional: false

  61-smoke-tests:
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
      - 48-openclaw-opik
      - 49-openclaw-account-ops
      - 50-agentgateway
      - 60-cortex-consumer
      - 61-smoke-tests
      - 70-dashboard
      - 80-agent-factory
      - 81-projects
      - 35a-langfuse
    optional: false
```

## Notes

- Agent computes topological sort of enabled spokes before execution.
- Optional spokes are skipped unless the questionnaire enabled them.
- `16-mongodb` is optional (questionnaire-gated).
- `35-opik` is optional and DEPRECATED — replaced by `35a-langfuse`
  because the Opik backend hardcodes MySQL, which violates the
  CortexOS PostgreSQL-only rule.
- All other spokes are required.
- Spoke numbering has intentional gaps (e.g. 18→20, 35→40) to allow future insertion without renumbering.
