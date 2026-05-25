# CortexOS Setup

This file is intentionally short. The detailed replication contract lives in
[docs/AI-REPLICATION.md](docs/AI-REPLICATION.md).

## Required Path

```text
Paperclip -> Hermes profile -> 9Router -> model
                         |
                         -> Honcho memory
```

Paperclip owns workflow state. Hermes executes profile work. Honcho owns
memory. 9Router owns model routing. Ollama is used for local Honcho
embeddings.

## Install Order

Run the bootstrap prompt first:

```text
prompts/00-bootstrap.md
```

Then run the prompt phases in:

```text
prompts/tools/_order.md
```

Finish with:

```text
prompts/tools/99-final-validation.md
```

## Rules

- Install root is `/opt/cortexos`.
- Secrets live only in `/opt/cortexos/.secrets`.
- Dashboard seeds must be generic and public-safe.
- Public URLs are derived after install, not hardcoded into migrations.
- New projects get local Hermes profiles through
  `scripts/hermes-profile-create.mjs`.
- Private project names, hostnames, tokens, channel IDs, profile state, and
  Paperclip data are runtime-only.
