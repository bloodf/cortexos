# CortexOS Architecture

CortexOS is a single-host AI operations stack centered on Paperclip, Hermes,
Honcho, 9Router, and the dashboard. It is designed to be installed by an AI
coding agent from chat-first prompts while keeping secrets and private project
state out of the repository.

## Runtime Contract

```text
Operator / Dashboard
        |
        | service health, identity files, logs, admin views
        v
Paperclip -> Hermes profile -> 9Router -> model
                         |
                         v
                    Honcho memory

Honcho embeddings -> Ollama nomic-embed-text:latest
```

Paperclip is the only work and issue surface. Hermes is the only agent runtime.
Honcho is the only memory backend. 9Router is the only model gateway. Ollama is
used for local Honcho embeddings only.

CortexOS does not install a custom agent bus, relay, scheduler, graph dispatcher,
or direct provider model path. Cortex Hermes is the only profile allowed to act
as the Agent Factory through its skill. The dashboard must not expose Agent
Factory controls.

## Control Plane

The operator controls the machine through:

| Surface | Purpose |
| --- | --- |
| Dashboard | Service catalog, health, operational views, profile identity files, and admin workflows |
| Paperclip | Issues, approvals, runs, budgets, audit, and Hermes-backed agents |
| Hermes Web UI | Operator-facing Hermes profile interface |
| Tailscale Serve | Tailnet HTTPS access to loopback services |
| Cockpit and Webmin | Native host administration over the tailnet |
| Grafana and Langfuse | Metrics, logs, traces, and LLM observability |

The dashboard is native Next.js on systemd. It uses PostgreSQL and runtime env
from `/opt/cortexos/.secrets/dashboard.env`.

## Agent Execution

Hermes profiles are isolated runtime homes under `/opt/cortexos/hermes`. A
profile has identity files, config, optional filesystem MCP, Paperclip adapter
bindings, and a secret env file under `/opt/cortexos/.secrets/hermes`.

Baseline public installs create generic profiles such as `primary` and
`secondary`. Private project profiles are created locally on the target machine
with `scripts/hermes-profile-create.mjs` and are not committed.

Paperclip calls Hermes through the Hermes local adapter:

```text
Paperclip issue/run
        |
        v
hermes_local adapter
        |
        v
Hermes profile API
        |
        +--> 9Router for model calls
        +--> Honcho for memory
        +--> direct filesystem MCP for allowed project paths
```

AgentGateway exists to reduce MCP tool sprawl for shared external tools. It
must not include filesystem MCP; filesystem access belongs directly to the
Hermes profile that owns the project path.

## Memory And Model Routing

Honcho stores durable memory and knowledge for Hermes profiles. Text-generation
features route through 9Router. Embeddings route to the local Ollama embeddings
proxy and must remain 768-dimensional using `nomic-embed-text:latest`.

9Router is the OpenAI-compatible gateway for all model access. Provider keys are
entered into the 9Router Web UI or its encrypted store, not into repository
prompts, dashboard seeds, or committed files.

## Data And Secrets

Repository content is public-safe source of truth:

- install prompts
- scripts
- systemd templates
- Docker compose templates
- dashboard migrations and generic seeds
- Hermes templates and skills
- validation checks

Runtime-only content stays on the machine:

- `/opt/cortexos/.secrets`
- Paperclip data
- Honcho data
- Hermes profile state
- generated caches and logs
- certificates and private domains
- private project workspaces and profile names

Dashboard seeds may include loopback endpoints and generic `/opt/cortexos`
paths. They must not include tokens, private project names, channel IDs,
customer names, private hostnames, or personal URLs.

## Network Model

Services bind to loopback by default. Public or operator access is derived after
install, usually through Tailscale Serve.

| Port | Service |
| ---: | --- |
| 11434 | 9Router |
| 11435 | Ollama embeddings proxy |
| 18690 | Honcho |
| 18691+ | Hermes profile APIs |
| 3033 | Paperclip proxy |
| 3034 | Paperclip upstream |
| 3080 | Dashboard |
| 9119 | Hermes Web UI |
| 10000 | Webmin |

Migrations and seeds must not hardcode a machine-specific Tailscale domain.

## Install Flow

The install flow is chat-first:

1. Paste `docs/AI-INSTALLER-PROMPT.md` into the AI harness.
2. The AI asks for required values in chat and waits for answers.
3. `prompts/00-bootstrap.md` materializes the repo and secrets safely.
4. Core prompts run in `prompts/tools/_order.md`.
5. Optional prompts run only when the operator asks for those apps.
6. `prompts/tools/99-final-validation.md` and production readiness gates prove
   the machine is healthy.

Prompts must not require pre-existing operator env vars. They can source
runtime env files after those files are created by earlier prompts.

## Validation Model

The repository and live machine are validated together:

```bash
rtk pnpm check:prompt-chat-contract
rtk pnpm check:repo-leaks
rtk pnpm audit:docker-names
rtk pnpm audit:runtime-sync -- --strict
rtk pnpm --filter cortexos-scripts test
rtk pnpm --filter @cortexos/dashboard test
scripts/cortex-production-readiness.sh
```

Production readiness checks command availability, service health, embedding
dimensions, 9Router model availability, Honcho routing, Docker naming,
Paperclip/Hermes registration, and dashboard access.

## Extension Points

- Add a service by adding a prompt, template, dashboard seed, docs entry, and
  validation where appropriate.
- Add a project by creating local Hermes profiles and Paperclip bindings after
  the base machine is healthy.
- Add tools to AgentGateway only when they are shared external tools.
- Add filesystem access directly to the Hermes profile that owns the path.
- Add model providers through 9Router, not through direct provider SDK calls.
