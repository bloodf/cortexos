# Agent Factory Templates

Hermes-compatible workspace files for CortexOS agents. These templates define the full runtime environment for autonomous agents operating on the VPS.

## Usage

When creating a new agent, copy all template files to the agent's workspace directory and replace placeholders:

| Placeholder         | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `{agent_name}`      | Agent display name                                        |
| `{role}`            | Agent role (CEO, CTO, PM, dev, QA, etc.)                  |
| `{repo}`            | GitHub repository name                                    |
| `{model}`           | Primary model via 9Router                                 |
| `{default_model}`   | Default model for work (default: `9router/cx/gpt-5.5`)    |
| `{review_model}`    | Model for antagonist cross-reviews                        |
| `{emoji}`           | Agent emoji identifier                                    |
| `{creature_type}`   | Agent creature type (e.g., "digital owl", "code phoenix") |
| `{vibe}`            | One-line personality vibe                                 |
| `{date}`            | Creation date                                             |
| `{timestamp}`       | ISO timestamp                                             |
| `{stage}`           | Pipeline stage name                                       |
| `{type}`            | Commit type                                               |
| `{scope}`           | Commit scope                                              |
| `{Honcho_port}` | Honcho knowledge base port (default `18690`) |

## File Purposes

Runtime requires 9 canonical files per agent workspace. `SLACK.md` is supplementary protocol guidance and is not enforced by `verify-pipeline.sh`. ROLE.md is provided per agent from `templates/agent-roles/`.

| File         | Purpose                                                                     | Lines             |
| ------------ | --------------------------------------------------------------------------- | ----------------- |
| SOUL.md      | Operating principles, communication style, red lines, proactive behavior    | Core identity     |
| IDENTITY.md  | Name, role, emoji, creature type, vibe                                      | Quick reference   |
| BOOTSTRAP.md | Full session startup sequence, memory loading, model config, heartbeat init | Boot protocol     |
| AGENTS.md    | Workspace rules, memory management, quality gates, pipeline, git protocol   | Primary rulebook  |
| ROLE.md      | Role-specific responsibilities, model, scope (from agent-roles/<ROLE>.md)   | Role contract     |
| TOOLS.md     | VPS tools, 9Router, Floci, databases, skills system, MCP servers            | Environment       |
| MEMORY.md    | Curated long-term memory with privacy rules and maintenance protocol        | Persistent memory |
| HEARTBEAT.md | Session state, current work, reminders, periodic check tracking             | State file        |
| USER.md      | Owner preferences, authority rules, trusted operator, privacy               | Human interface   |

Supplementary (not in REQUIRED_FILES):

| File     | Purpose                                                                      |
| -------- | ---------------------------------------------------------------------------- |
| SLACK.md | Slack thread protocol for agent visibility and approvals                     |

## Key Concepts

- **9Router**: All AI model calls route through 9Router at `127.0.0.1:11434/v1`. No direct provider calls. The model catalog source of truth is `GET /v1/models`; Hermes profiles must load `/opt/cortexos/.secrets/9router.env` and keep their `providers.9router.models` synced from that endpoint so `/model` never shows an empty 9Router picker.
- **Antagonist Review**: Cross-model review before pipeline stage transitions. BLOCK/PASS verdicts.
- **Quality Gates**: gstack skill pipeline — office → ceo → eng → dev → review → qa → ship → retro.
- **Agent Routing Tokens**: `@pm` is not a GitHub account; `templates/workflows/agent-mention-router.yml` should be installed as `.github/workflows/agent-mention-router.yml` and converts it into `agent:pm` + `needs-clarification` labels for PM polling.
- **Git Policy**: every code-writing agent must follow [`GIT_POLICY.md`](GIT_POLICY.md) — worktree per task; hotfix/bugfix/chore push direct to `main`; PR only when CI workflow or owner approval gate requires it.
- **GitHub Templates**: agents must use `templates/github/PULL_REQUEST_TEMPLATE.md` for PRs and `templates/github/ISSUE_TEMPLATE/agent-task.md` for issues.
- **Slack Threads**: agents use one Slack bot and one thread per GitHub issue/PR per `SLACK.md`; do not post every update as a new top-level channel message.
- **Approval Flow**: merge-ready PRs request approval in the Slack thread (primary); Telegram inline buttons are an owner-only fallback. Text fallback (`APPROVE`, `APPROVED`, `MERGE`, `REJECT`) accepted on both surfaces.
- **Memory Hierarchy**: Daily files (`memory/YYYY-MM-DD.md`) distilled into curated `MEMORY.md`; Honcho stores searchable indexed knowledge.
- **Heartbeat**: check-in cycle for status, memory maintenance, and proactive work.
- **Plan-First**: writing-plans → executing-plans with batch checkpoints. No coding without a plan.
- **First Work: Green CI**: every project agent's first implementation task is to make CI green under `CI_POLICY.md`: unit tests, lint, typecheck/build as applicable; no e2e, ESP32/hardware, or iOS/Android native app builds until the owner asks to restore them.
- **Operational Guidance**: local policy files (`CI_POLICY.md`, `TELEGRAM_APPROVAL.md`, `ESCALATION.md`, `STACK.md`) define repo-specific verification, approvals, escalation, and stack context.
- **App Attachments**: factory promotion must copy `agent_factories.definition.apps` into the generated project/agent metadata. Values are dashboard `services.slug` entries only; credentials remain in service `env_source` files and runtime secrets. Baseline agent apps: `paperclip`, `honcho`, `9router`, `cortex-dashboard`, `langfuse`.

## Reusable Workflow Packs

| Pack              | Files                                                                         | Use case                                                                                      |
| ----------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Cortex operations | `templates/hermes/cortex/` + `templates/hermes/skills/cortex-factory-creation/` | Standalone machine-owner profile for infrastructure, Hermes, model gateway, memory, and factory stewardship |
| Book writing      | `templates/agent-workflows/book-writing/` + `templates/agent-roles/BOOK-*.md` | Multi-agent author/editor/reviewer/evaluator/translator workflow for books and long-form docs |

Factory agent role files are in `templates/agent-roles/`. Cortex itself is a
standalone Hermes profile and is not registered as a Paperclip agent.
