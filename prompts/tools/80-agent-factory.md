# 80 — Agent Factory

## Purpose

Seed and verify dashboard project factories that create Paperclip roles backed
by Hermes profiles. This spoke does not install a custom workflow bus.

## Prerequisites

- `70-dashboard.md` completed.
- Paperclip service reachable.
- Hermes profiles registered.

## Contract

Factory definitions must use:

- `adapter: "hermes_local"`
- one Hermes profile per project
- `ticket_link_table: "paperclip_ticket_link"`
- stable Paperclip role codes for seats

Do not add custom bus subjects, gateway IDs, or legacy runtime paths.

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
