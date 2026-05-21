# CortexOS Architecture

CortexOS is now centered on Paperclip, Hermes profiles, Honcho memory, 9Router,
and the dashboard.

```text
Operator / Dashboard
        │
        ├── service health, secrets, audit, approvals
        │
Paperclip ── hermes-paperclip-adapter ── Hermes profile ── 9Router
                                             │
                                             └── Honcho memory
```

Each project gets an isolated Hermes profile. Shared infrastructure remains
PostgreSQL, Redis, Tailscale, Prometheus, Loki, Grafana, and Langfuse.

## Ports

| Port | Service |
|---:|---|
| 3080 | Dashboard |
| 11434 | 9Router |
| 18690 | Honcho |
| 18691 | Hermes Primary |
| 18692 | Hermes Secondary |
| 3032 | Paperclip |
| 3001 | Langfuse |

## Extension Points

- Add a project by creating a Hermes profile and Paperclip role bindings.
- Add memory by importing into Honcho under the project workspace.
- Add dashboard services through migrations and dynamic seed entries.
