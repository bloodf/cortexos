# AI Installer Prompt

Copy and paste the prompt below into the AI agent that will install CortexOS.
It is intentionally chat-first: the agent must ask for values, wait for the
answers, and then produce concrete commands. It must not assume operator env
vars already exist.

```text
You are installing CortexOS from this repository.

Read these files before taking action:

- README.md
- docs/AI-REPLICATION.md
- SETUP.md
- prompts/CHAT-INPUT-CONTRACT.md
- prompts/00-bootstrap.md
- prompts/tools/_order.md
- prompts/tools/99-final-validation.md

Goal:
Install a reproducible CortexOS machine at /opt/cortexos using only the
current runtime:

Paperclip -> Hermes profile -> 9Router -> model
Hermes -> Honcho memory
Honcho embeddings -> Ollama nomic-embed-text:latest

Rules:

- Do not assume any environment variables are already defined.
- Ask me for required values in chat, wait for my answer, then write commands
  that include those answered values.
- Keep secrets out of Git, prompts, docs, dashboard seeds, logs, and command
  transcripts.
- Store runtime secrets only under /opt/cortexos/.secrets with mode 600.
- Keep dashboard seeds generic and public-safe.
- Use 127.0.0.1 for service-to-service examples.
- Route all model calls through 9Router.
- Use Paperclip as the only workflow and issue surface.
- Use Hermes profiles for agent execution.
- Use Honcho as the memory and knowledge backend.
- Use Ollama nomic-embed-text:latest only for local Honcho embeddings.
- Do not install a custom workflow bus, relay, separate scheduler,
  orchestration sidecar, or direct provider API model path.
- Do not expose Agent Factory controls in the dashboard. Only the Cortex Hermes
  profile can act as the Agent Factory through its skill.
- Do not commit generated profile homes, Paperclip data, Honcho data, local
  certificates, logs, caches, private hostnames, project names, tokens, channel
  IDs, or runtime secrets.

Start:

1. Ask me for:
   - target_host
   - sudo_user
   - cortex_root, default /opt/cortexos
   - cortex_domain
   - whether this is a new machine or repair of an existing machine
2. Use prompts/00-bootstrap.md to materialize the repo and secrets safely.
3. Run the core prompts in prompts/tools/_order.md in order.
4. Run prompts/tools/99-final-validation.md.
5. Run the final gates:

   rtk pnpm check:repo-leaks
   rtk pnpm audit:docker-names
   rtk pnpm audit:runtime-sync -- --strict
   rtk pnpm --filter cortexos-scripts test
   rtk pnpm --filter @cortexos/dashboard test
   scripts/cortex-production-readiness.sh

Stop and ask before:

- deleting data
- rotating credentials
- changing public exposure
- creating private project/profile names
- accepting a command that embeds a secret directly
- deviating from the runtime contract above
```

Expected end state:

- Production readiness passes.
- Docker has no numbered duplicate containers.
- Paperclip/Hermes registration smoke passes.
- Honcho uses 9Router for text generation and Ollama for 768-dimensional
  embeddings.
- Runtime files in `/opt/cortexos` match the repository where the sync audit
  expects them to match.
