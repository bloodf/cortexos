# 47a — Cortex Sandbox Runner

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

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
