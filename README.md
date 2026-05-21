# CortexOS

CortexOS is a self-hosted control plane for infrastructure operations, agent
profiles, service health, secrets, and Paperclip-governed AI work.

The current dev architecture is:

```text
Paperclip → hermes-paperclip-adapter → Hermes profile → 9Router → model
                                          │
                                          └── Honcho memory/knowledge
```

the retired custom agent workflow stack has been removed
from the active stack.

## Core Services

- **Dashboard**: Next.js admin UI and service catalog.
- **9Router**: local model gateway.
- **Hermes**: one profile per project, starting with `primary` and `secondary`.
- **Honcho**: memory and knowledge store for Hermes profiles.
- **Paperclip**: workflow, budgets, approvals, and audit-facing governance.
- **Langfuse**: LLM observability.
- **Prometheus/Loki/Grafana**: host and service observability.

## Setup

Read [REQUIREMENTS.md](REQUIREMENTS.md), then follow [SETUP.md](SETUP.md).
The canonical install graph lives in [prompts/tools/_order.md](prompts/tools/_order.md).

## Dashboard

The dashboard catalog and dynamic seed expect:

- Honcho: `http://127.0.0.1:18690`
- Hermes Primary: `http://127.0.0.1:18691`
- Hermes Secondary: `http://127.0.0.1:18692`
- Paperclip: `http://127.0.0.1:3032`

Hermes and Honcho APIs may be exposed to the operator machine through the
authenticated Tailscale/Caddy path defined in `prompts/tools/44-api-exposure.md`.

## License

MIT
