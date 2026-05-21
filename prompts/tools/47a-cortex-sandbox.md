# 47a — Cortex Sandbox Runner

## Purpose

Build the sandbox runner as an optional execution safety service for tools that
need an isolated process. It is not an agent communication layer and it does
not dispatch work. Paperclip + Hermes remain the only agent workflow path.

## Contract

- No custom workflow bus wiring.
- Expose only the local sandbox HTTP API to trusted local services.
- Audit output goes to the dashboard audit API when configured.

## Verify

```bash
docker compose -f stacks/cortex-sandbox-runner/docker-compose.yml config
curl -fsS http://127.0.0.1:18770/health
```

## CHECKPOINT 1

Confirm the sandbox health endpoint responds locally.

## Next

→ `prompts/tools/49-memory-import-prep.md`
