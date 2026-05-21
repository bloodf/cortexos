# CortexOS Setup

This repository now uses a Hermes + Honcho + Paperclip agent stack.
the retired custom agent workflow stack is disabled for this dev server.

## Required Agent Path

Paperclip is the only workflow entry point. Paperclip sends work through the
Hermes Paperclip adapter, Hermes runs the project profile, and Honcho stores
memory and knowledge.

Default Hermes profiles:

- `primary` on `127.0.0.1:18691`
- `secondary` on `127.0.0.1:18692`, model `cx/gpt-5.5`, reasoning `medium`

Honcho runs on `127.0.0.1:18690`. 9Router remains the model gateway.

## Install Order

Use `prompts/tools/_order.md` as the source of truth. The core path is:

```text
00-preflight
→ 10-os-hardening → 09-homebrew → 11-docker → 12-tailscale → 12a-sops-bootstrap → 13-tailscale-serve
→ 14-postgresql → 15-redis
→ 20-prometheus → 21-loki → 22-grafana → 23-fluent-bit → 24-cadvisor → 25-node-exporter
→ 26-cockpit → 26a-otel-collector → 27-dockhand → 28-floci
→ 31-9router → 32-honcho → 34-kernel-browser
→ 40-hermes → 41-hermes-profiles → 42-hermes-honcho → 43-paperclip-hermes → 44-api-exposure
→ 49-memory-import-prep → 55-langfuse → 62-paperclip → 70-dashboard → 80-agent-factory → 81-projects
→ 99-final-validation
```

## Operator Rules

- Do not install or resurrect retired agent services.
- Preserve any old legacy agent data only as import material under
  `/opt/cortexos/backups/memory-import-pending/`.
- Expose Hermes and Honcho only through the authenticated Tailscale path.
- Register new projects as new Hermes profiles instead of creating a shared
  singleton Hermes runtime.
