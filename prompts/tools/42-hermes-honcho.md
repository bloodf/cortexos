# Hermes + Honcho

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Configure each Hermes profile to use Honcho as its memory backend.

## Rule

Honcho is the only memory backend. Legacy memory services are not installed.

## Configure

For every profile in `/opt/cortexos/hermes/profiles.json`, configure:

- Honcho base URL: `http://127.0.0.1:18690`
- Honcho workspace: profile slug
- AI peer: `hermes-<profile>`
- Session key: `<profile>:<role>:<issue-id>`

Use Hermes' installed config command names discovered in `40-hermes.md`.

## Verify isolation

Create a memory fact in `primary` and confirm `secondary` cannot retrieve it.
Create a memory fact in `secondary` and confirm `primary` cannot retrieve it.

## Next

→ `prompts/tools/42a-hermes-mcp.md`
