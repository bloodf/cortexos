# 80 — Agent Factory

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Install and verify the Cortex Hermes-only Agent Factory workflow that creates
Paperclip roles backed by Hermes profiles. This spoke does not install a custom
workflow bus and does not expose Agent Factory controls in the dashboard.

## Prerequisites

- `70-dashboard.md` completed.
- Paperclip service reachable.
- Hermes profiles registered.
- Cortex Hermes profile reachable.

## Contract

Cortex Hermes is the only actor allowed to create, mutate, or promote factory
definitions. The dashboard may keep the `agent_factories` table as durable
state, but it must not expose an Agent Factory page, API, or dashboard chat
tools.

Factory definitions must use:

- `adapter: "hermes_local"`
- one Hermes profile per project
- the shared coding MCP bundle from the runtime Hermes profile
- `ticket_link_table: "paperclip_ticket_link"`
- stable Paperclip role codes for seats
- an `apps` array listing dashboard service/app slugs every generated agent should see
- per-seat `apps` overrides only when a role needs a narrower or wider app set

Do not add custom bus subjects, gateway IDs, or legacy runtime paths.
Do not write generated profile names, project-agent files, local paths, or
secrets into the repository. Factory promotion writes generated agents only to
runtime Hermes/Paperclip storage.

App attachment contract:

- `definition.apps` is the baseline app/service allowlist for the factory.
- Each entry is a dashboard `services.slug` value, not a URL or credential.
- Generated agents inherit `definition.apps` into their project env/profile metadata.
- A seat may set `apps` to override the baseline for that role.
- Runtime credentials still come from service `env_source` files and secrets; factory JSON never stores app secrets.
- New factories must include at least the core agent apps: `paperclip`, `honcho`, `9router`, `cortex-dashboard`, `langfuse`.

## Skill

Install `templates/hermes/skills/cortex-factory-creation` into the Cortex Hermes
profile only. Other project profiles may execute generated factory agents, but
they are not allowed to act as the factory creator.

## Verify

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard <<'SQL'
SELECT slug, definition->'paperclip' AS paperclip
FROM agent_factories
ORDER BY slug;
SQL
```

## CHECKPOINT 1

Confirm factory definitions reference `hermes_local` and do not include retired
workflow fields.

## Next

→ `prompts/tools/81-projects.md`
