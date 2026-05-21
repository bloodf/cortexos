# Stack

Canonical CortexOS runtime:

- Paperclip: workflow and issue surface.
- Hermes: agent execution profiles.
- Honcho: memory and knowledge backend.
- Ollama: local embeddings with `nomic-embed-text:latest`.
- 9Router: model routing and tool-calling reasoning gateway.
- Dashboard: Next.js operations UI backed by PostgreSQL.

Do not add direct provider API calls, custom workflow buses, or orchestration sidecars.
