# 47a — Cortex Sandbox Runner

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

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
