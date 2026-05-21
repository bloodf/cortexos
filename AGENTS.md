@/home/cortexos/.codex/RTK.md

# CortexOS Agent Instructions

CortexOS is an all-in-one installer and operations project for the current
Paperclip, Hermes, Honcho, Ollama, and 9Router stack.

## Current Runtime

- Paperclip is the workflow and issue surface.
- Hermes profiles execute agent work.
- Honcho is the memory and knowledge backend.
- Honcho uses Ollama `nomic-embed-text:latest` for local embeddings.
- Honcho uses 9Router for tool-calling reasoning features.
- Dashboard migrations and seeds describe only the current runtime.

## Repository Rules

- Use `rtk` for shell commands in this repo.
- Do not add direct provider API calls; route model calls through 9Router.
- Do not add separate agent workflow buses or custom orchestration sidecars.
- Keep installer prompts, templates, and dashboard seeds aligned with the
  current runtime.
- Store durable workflow state in Paperclip, project files, the dashboard DB,
  or Honcho. Do not rely on transient memory alone.
