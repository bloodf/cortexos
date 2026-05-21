# Spoke Dependency Graph

Declarative dependency map for `prompts/tools/`. Each spoke lists its required
predecessors. SETUP.md reads this file to compute install order and skip
disabled optional spokes.

```yaml
spokes:
  00-preflight:
    deps: []
    optional: false

  10-os-hardening:
    deps: [00-preflight]
    optional: false

  09-homebrew:
    deps: [10-os-hardening]
    optional: false

  11-docker:
    deps: [09-homebrew]
    optional: false

  12-tailscale:
    deps: [11-docker]
    optional: false

  12a-sops-bootstrap:
    deps: [12-tailscale]
    optional: false

  13-tailscale-serve:
    deps: [12-tailscale, 12a-sops-bootstrap]
    optional: false

  14-postgresql:
    deps: [10-os-hardening]
    optional: false

  14a-home-assistant:
    deps: [11-docker, 13-tailscale-serve]
    optional: false

  14b-jellyfin:
    deps: [11-docker, 13-tailscale-serve]
    optional: false

  15-redis:
    deps: [11-docker]
    optional: false

  16-mongodb:
    deps: [11-docker]
    optional: true

  16a-mysql:
    deps: [11-docker]
    optional: true

  17-dnsmasq:
    deps: [10-os-hardening]
    optional: false

  18-fail2ban:
    deps: [10-os-hardening, 17-dnsmasq]
    optional: false

  20-prometheus:
    deps: [11-docker, 13-tailscale-serve]
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

  26-cockpit:
    deps: [10-os-hardening, 13-tailscale-serve]
    optional: false

  26a-otel-collector:
    deps: [11-docker, 20-prometheus]
    optional: false

  26b-webmin:
    deps: [10-os-hardening, 13-tailscale-serve]
    optional: false

  27-dockhand:
    deps: [11-docker, 13-tailscale-serve]
    optional: false

  28-floci:
    deps: [11-docker, 13-tailscale-serve]
    optional: false

  31-9router:
    deps: []
    optional: false

  32-honcho:
    deps: [11-docker, 31-9router]
    optional: false

  34-kernel-browser:
    deps: [11-docker, 31-9router]
    optional: false

  40-hermes:
    deps: [31-9router, 32-honcho]
    optional: false

  41-hermes-profiles:
    deps: [40-hermes]
    optional: false

  42-hermes-honcho:
    deps: [41-hermes-profiles, 32-honcho]
    optional: false

  42a-hermes-mcp:
    deps: [42-hermes-honcho]
    optional: false

  43-paperclip-hermes:
    deps: [42a-hermes-mcp]
    optional: false

  44-api-exposure:
    deps: [13-tailscale-serve, 41-hermes-profiles, 32-honcho]
    optional: false

  47a-cortex-sandbox:
    deps: [11-docker, 12a-sops-bootstrap]
    optional: false

  49-memory-import-prep:
    deps: [42-hermes-honcho]
    optional: false

  55-langfuse:
    deps: [14-postgresql, 11-docker, 40-hermes]
    optional: false

  56-pgadmin:
    deps: [14-postgresql]
    optional: false

  57-redisinsight:
    deps: [15-redis]
    optional: false

  58-mongo-express:
    deps: [16-mongodb]
    optional: true

  59-phpmyadmin:
    deps: [16a-mysql]
    optional: true

  62-paperclip:
    deps: [43-paperclip-hermes]
    optional: false

  70-dashboard:
    deps: [14-postgresql, 13-tailscale-serve, 32-honcho, 40-hermes, 62-paperclip]
    optional: false

  80-agent-factory:
    deps: [70-dashboard]
    optional: false

  81-projects:
    deps: [70-dashboard]
    optional: false

  82-mail-guardian:
    deps: [31-9router, 41-hermes-profiles, 70-dashboard]
    optional: true

  99-final-validation:
    deps:
      - 18-fail2ban
      - 22-grafana
      - 23-fluent-bit
      - 24-cadvisor
      - 25-node-exporter
      - 14a-home-assistant
      - 14b-jellyfin
      - 26-cockpit
      - 26a-otel-collector
      - 26b-webmin
      - 27-dockhand
      - 28-floci
      - 32-honcho
      - 34-kernel-browser
      - 42-hermes-honcho
      - 42a-hermes-mcp
      - 43-paperclip-hermes
      - 44-api-exposure
      - 47a-cortex-sandbox
      - 49-memory-import-prep
      - 55-langfuse
      - 62-paperclip
      - 70-dashboard
      - 80-agent-factory
      - 81-projects
      - 12a-sops-bootstrap
    optional: false
```

## Notes

- Paperclip and Hermes are the only agent orchestration path.
- Honcho is the only memory backend.
- Retired agent workflow services are not part of the active graph.
