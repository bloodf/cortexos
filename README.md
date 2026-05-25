# CortexOS

+------------------------------------------------------------+
| CortexOS                                                   |
| Paperclip + Hermes + Honcho + 9Router, reproducible by AI  |
+------------------------------------------------------------+

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

Start by pasting [docs/AI-INSTALLER-PROMPT.md](docs/AI-INSTALLER-PROMPT.md)
into the AI agent that will run the install. That prompt tells the agent to ask
for all operator values in chat, avoid pre-existing env assumptions, keep
secrets out of Git, and execute the prompts in the correct order.

Then read [docs/AI-REPLICATION.md](docs/AI-REPLICATION.md). It is the source
of truth for what belongs in Git, what stays runtime-only, and how an AI agent
should install this stack without leaking private machine state.

Then follow:

1. [prompts/00-bootstrap.md](prompts/00-bootstrap.md)
2. [prompts/tools/_order.md](prompts/tools/_order.md)
3. [prompts/tools/99-final-validation.md](prompts/tools/99-final-validation.md)

## Paste-Ready Installer Prompt

Use this when starting a fresh AI agent session:

```text
You are installing CortexOS from this repository. Read README.md,
docs/AI-INSTALLER-PROMPT.md, docs/AI-REPLICATION.md, SETUP.md,
prompts/00-bootstrap.md, and prompts/tools/_order.md first.

Install CortexOS to /opt/cortexos. Do not assume any environment variables
already exist. Ask me for required values in chat, wait for my answers, and
then generate concrete commands using those answers.

Never paste secrets into Git, docs, prompts, shell history, logs, or dashboard
seeds. Runtime secrets belong only under /opt/cortexos/.secrets with mode 600.

Use the current runtime only:
Paperclip -> Hermes profile -> 9Router -> model
Hermes -> Honcho memory
Honcho embeddings -> Ollama nomic-embed-text:latest

Do not install a custom workflow bus, relay, orchestration sidecar, direct
provider model path, or dashboard Agent Factory UI. Cortex Hermes is the only
agent allowed to act as the Agent Factory.

Follow prompts/00-bootstrap.md, then every core prompt in
prompts/tools/_order.md, then prompts/tools/99-final-validation.md. Stop and
ask before any destructive command, credential rotation, public exposure
change, or private project/profile creation.

When finished, run:
rtk pnpm check:repo-leaks
rtk pnpm audit:docker-names
rtk pnpm audit:runtime-sync -- --strict
rtk pnpm --filter cortexos-scripts test
rtk pnpm --filter @cortexos/dashboard test
scripts/cortex-production-readiness.sh
```

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
rtk pnpm audit:docker-names
rtk pnpm audit:runtime-sync -- --strict
rtk pnpm --filter cortexos-scripts test
rtk pnpm --filter @cortexos/dashboard test
```

Runtime secrets live under `/opt/cortexos/.secrets` and are never committed.
Dashboard seeds and prompts must stay generic and public-safe.
