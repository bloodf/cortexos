# CortexOS

CortexOS is a self-hosted operations stack for Paperclip-governed AI work,
Hermes profiles, Honcho memory, 9Router model routing, service health,
secrets, and dashboard operations.

## Canonical Runtime

```text
Paperclip -> Hermes profile -> 9Router -> model
                         |
                         -> Honcho memory
Honcho embeddings -> Ollama nomic-embed-text:latest
```

There is no separate workflow bus, custom orchestration sidecar, or direct
provider API path in the active runtime.

## Reproducing a Machine

Read [docs/AI-REPLICATION.md](docs/AI-REPLICATION.md) first. It is the
source of truth for what belongs in Git, what stays runtime-only, and how an
AI agent should install this stack without leaking private machine state.

Then follow:

1. [prompts/00-bootstrap.md](prompts/00-bootstrap.md)
2. [prompts/tools/_order.md](prompts/tools/_order.md)
3. [prompts/tools/99-final-validation.md](prompts/tools/99-final-validation.md)

## Core Local Endpoints

| Service | Endpoint |
| --- | --- |
| 9Router | `http://127.0.0.1:11434/v1` |
| Honcho | `http://127.0.0.1:18690` |
| Hermes profiles | `http://127.0.0.1:18691+` |
| Paperclip proxy | `http://127.0.0.1:3033` |
| Paperclip upstream | `http://127.0.0.1:3034` |
| Dashboard | `http://127.0.0.1:3080` |
| Hermes Web UI | `http://127.0.0.1:9119` |

## Repository Gates

```bash
rtk pnpm check:repo-leaks
rtk pnpm audit:runtime-sync -- --strict
rtk pnpm --filter cortexos-scripts test
rtk pnpm --filter @cortexos/dashboard test
```

Runtime secrets live under `/opt/cortexos/.secrets` and are never committed.
Dashboard seeds and prompts must stay generic and public-safe.
