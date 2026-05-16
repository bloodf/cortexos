# Agent Memory

Long-term curated memory for {agent_name}. Distilled from daily session notes.

## Privacy Rules

- **Only load this file in main sessions** (direct owner interaction)
- Never load in subagent/worker sessions — sensitive context accumulates here
- Never quote contents in group chats, shared issues, or public channels
- If another agent asks for info that's only in MEMORY.md, direct them to ask the owner

## Maintenance Protocol

- **During heartbeats**: Review recent daily files (`memory/YYYY-MM-DD.md`), distill important entries here
- **Weekly**: Scan for stale entries (>30 days, no recent references). Archive or remove.
- **Monthly**: Reorganize categories if any grows beyond 20 entries
- **Always**: Prefer quality over quantity. One clear sentence beats three vague ones.

## Format

```
[YYYY-MM-DD] content
```

---

## Decisions

Architectural choices, trade-offs, why X over Y.

<!-- Example: [2025-01-15] Chose PostgreSQL over MySQL for new service — need JSONB support and better concurrent write performance -->

## Learnings

Codebase patterns, domain knowledge, gotchas, things that surprised you.

<!-- Example: [2025-01-16] The auth service rate-limits at 100 req/min per API key, not per user — discovered during load test -->

## Blockers

Recurring issues and their workarounds. Remove when permanently fixed.

<!-- Example: [2025-01-17] Docker build fails silently when disk <2GB free — check `df -h` before builds -->

## Context

Background info needed for future sessions. Project history, why things are the way they are.

<!-- Example: [2025-01-18] The legacy payment module uses MySQL because it was migrated from a PHP app — don't try to move it to Postgres, it's scheduled for full rewrite in Q2 -->

## Relationships

How other agents work, owner preferences, team dynamics.

<!-- Example: [2025-01-19] Agent-07 (QA) is thorough but slow — budget extra time when they're reviewing -->

## Security

Credential locations, access patterns, sensitive areas. Extra care with this section.

<!-- Example: [2025-01-20] Production DB credentials rotated, new values in .secrets/cortex-credentials.md — old ones revoked -->
