# Bootstrap Sequence

On every session start, execute this sequence in order. Don't ask permission — just do it.

## 1. Load Identity Files

Read these files in order. If any file is missing, log it and continue.

1. `SOUL.md` — your personality, principles, red lines
2. `IDENTITY.md` — your name, role, creature type
3. `USER.md` — about the human owner, authority rules
4. `AGENTS.md` — workspace rules, memory protocol, pipeline rules

## 2. Load Memory

Memory loading depends on session type:

- **Main session** (direct owner interaction):
  1. Read `MEMORY.md` — your curated long-term memory
  2. Read today's daily file `memory/YYYY-MM-DD.md` (if exists)
  3. Read yesterday's daily file (if exists, for continuity)
- **Subagent/worker session** (spawned by another agent):
  1. Read `MEMORY.md` only if the parent agent passes it explicitly
  2. Do NOT read MEMORY.md by default — it contains sensitive context not meant for all sessions
  3. Daily files are not loaded in worker sessions

**Security rationale**: MEMORY.md accumulates private context (credentials references, personal preferences, internal decisions). Limiting its exposure to main sessions reduces the blast radius if a subagent is compromised or misbehaves.

## 3. Load State

1. Read `HEARTBEAT.md` — last session state, current work, reminders
2. Check GitHub issues assigned to you: `gh issue list --assignee @me --state open`
3. Check for any pending PRs: `gh pr list --author @me --state open`

## 4. Model Configuration

All AI calls go through 9Router. Never call provider APIs directly.

Endpoints are mirrored from `.shared/endpoints.md` (canonical). Update there first if they change.

```
Endpoint:      http://127.0.0.1:20128/v1/chat/completions
Models list:   http://127.0.0.1:20128/v1/models
Default model: 9router/cx/gpt-5.5
Fast model:    9router/cx/gpt-5.5 (with max_tokens reduced)
Review model:  {review_model} (for antagonist cross-reviews)
```

When 9Router is unreachable, STOP and report. Do not fall back to direct provider calls.

## 5. Heartbeat Protocol

After bootstrap completes:

1. Write session start to `HEARTBEAT.md`:
   ```
   ## Last Session
   - **Start**: {current ISO timestamp}
   - **Status**: active
   ```
2. Set heartbeat interval: check in every 30 minutes with status update
3. During heartbeat: run memory maintenance, check for new assignments, update HEARTBEAT.md

## 6. Canonical Files

These files define your workspace. Know where they are:

| File | Purpose | Load on boot |
|------|---------|--------------|
| `SOUL.md` | Identity, principles, red lines | Always |
| `IDENTITY.md` | Name, role, avatar | Always |
| `USER.md` | Owner preferences, authority | Always |
| `AGENTS.md` | Workspace rules, protocols | Always |
| `MEMORY.md` | Curated long-term memory | Main sessions only |
| `HEARTBEAT.md` | Session state, reminders | Always |
| `TOOLS.md` | Available tools, endpoints | Reference as needed |
| `memory/YYYY-MM-DD.md` | Daily session notes | Main sessions only |
| `skills/*/SKILL.md` | Skill definitions | When skill invoked |

## 7. Announce Ready

After loading completes:

1. Log what was loaded and what was missing
2. Summarize last session status from HEARTBEAT.md
3. List any open issues/PRs assigned to you
4. Begin processing assigned work

## 8. Session End

Before session terminates:

1. Write today's daily memory file with session learnings
2. Update `MEMORY.md` — distill important daily entries into curated long-term memory
3. Update `HEARTBEAT.md` with end timestamp, status, and summary
4. If work is incomplete, document where to resume in HEARTBEAT.md
