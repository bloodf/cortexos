# CLAUDE.md

> Operating instructions for AI agents working inside CortexOS repository.

## Project context

CortexOS is an all-in-one installer and operations project for the current Paperclip, Hermes, Honcho, Ollama, and 9Router stack. Repository slug and paths use `cortexos`.

## Non-negotiable rules

- Never commit secrets, tokens, private keys, private IPs, or live credentials.
- Use `/opt/cortexos` and `CORTEX_ROOT`; do not reintroduce legacy names.
- Preserve checkpoint behavior in setup prompts.
- Update docs when behavior, paths, ports, subjects, roles, or credentials change.
- Keep security-sensitive operations explicit, auditable, and reversible.
- Supported host OS: Ubuntu 24.04 LTS, Ubuntu 25.x, Debian 13 Trixie. No Fedora / RHEL / Rocky / Alma support.
- All distro-sensitive shell operations must go through `scripts/pkg.sh`; never call `apt-get` directly in prompts or scripts.
- Model calls route through 9Router. Do not add direct provider API calls.
- Paperclip is the workflow and issue surface.
- Hermes profiles execute agent work.
- Honcho is the memory and knowledge backend.
- Honcho uses Ollama `nomic-embed-text:latest` for local embeddings.
- Honcho uses 9Router for tool-calling reasoning features.
- Dashboard migrations and seeds describe only the current runtime.
- Store durable workflow state in Paperclip, project files, the dashboard DB, or Honcho.
- Operator-laptop drives install. The laptop pushes repo/secrets to `/opt/cortexos`; do not assume the VPS has source before bootstrap.
- Dashboard builds on the VPS via `docker compose build`; no rsync of compiled artifacts.

## Common commands

```bash
rtk pnpm install
rtk pnpm --filter @cortexos/dashboard test
rtk pnpm --filter @cortexos/dashboard build
```

Use targeted tests when possible. Dashboard uses Next.js 16, TypeScript, Vitest, PostgreSQL migrations, and server routes.

## Editing guidance

- Prompts in `prompts/` are operator-facing product surface. Use formal, stepwise language.
- Templates in `templates/` must be safe to copy to VPS.
- Agent roles in `templates/agent-roles/` must define scope, escalation, review standards, and stop conditions.
- Docs should link related docs and include verification steps.

## Architecture reminders

- Dashboard package: `packages/cortex-dashboard/`.
- Host root: `/opt/cortexos`.
- Secrets root: `/opt/cortexos/.secrets`.
- Dashboard env: `/opt/cortexos/.secrets/dashboard.env`.
- Paperclip port: `3033`.
- 9Router OpenAI-compatible endpoint: `http://127.0.0.1:11434/v1`.
- Honcho endpoint: `http://127.0.0.1:18690`.
- Hermes primary endpoint: `http://127.0.0.1:18691/v1`.
- Hermes secondary endpoint: `http://127.0.0.1:18692/v1`.
- OS dispatcher: `scripts/os-detect.sh` + `scripts/pkg.sh`. OS prereq prompts: `prompts/os/*`.

## Completion checklist

- Search confirms no stale retired-service references in touched surfaces.
- Tests relevant to changed area pass.
- Markdown links resolve when docs are edited.
- Security and rollback notes exist for operational changes.
