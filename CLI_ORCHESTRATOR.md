# CLI Orchestrator Protocol — CortexOS

Generic autonomous multi-model development pipeline using Claude Code,
oh-my-claudecode, Headroom, claude-mem, and Pi Code. This document is the
reusable protocol spec; the runtime harness lives in `.planning/harness/`
(gitignored).

---

## Roles

| Handle | Tool / Model | Responsibility |
|--------|-------------|----------------|
| **Fable 5** | This Claude session | Lead orchestrator: planning, architecture, task breakdowns, decision selection, micro-plan authoring, fix planning. Autonomous decision owner before escalating to the human. |
| **GPT-5.5** | `pi -p --provider openai-codex --model gpt-5.5 --no-session -nt` | Antagonist reviewer — no tools, all evidence embedded in prompt. Reviews plans and diffs for gaps, bugs, weak assumptions, missing criteria. |
| **MiniMax M3** | `pi -p --provider minimax --model MiniMax-M3 --no-session` | Primary implementer via Pi Code. Executes exactly one approved micro-plan per dispatch. |
| **Kimi-for-coding** | `kimi -p "<prompt>"` | Deep code reviewer for M3 output. Never reviews its own commits. |
| **M2.7 Highspeed** | `pi -p --provider minimax --model MiniMax-M2.7-highspeed --no-session -t read,bash` | Fast CLI operator: validation commands, commit messages, commits, pushes, main/origin integration. |
| **Sonnet** | Claude Code subagent (`model: "sonnet"`) | Default future runtime orchestrator inside Claude Code; investigation, planning support, verification. |
| **Headroom** | `headroom` CLI + MCP tools (`headroom_compress`, `headroom_retrieve`, `headroom_stats`) | Context compression and reversible retrieval. Cross-agent handoff via SharedContext. Failure learning via `headroom learn`. |
| **claude-mem** | MCP tools (`memory_search`, timeline, `get_observations`) | Persistent memory. Prior-session recall, timeline reconstruction, durable observations. |

**Never let a model review its own output.** If a worker implemented a change,
a different model must review it.

---

## Autonomy rule

Work autonomously. Do not require human babysitting.

When a decision is needed:
1. Derive the best decision from project docs, existing code patterns, prior
   memory, `AGENTS.md`, `CLAUDE.md`, and the safest low-blast-radius default.
2. If a reasonable default exists, choose it, document the rationale, and continue.
3. Ask the human **only** when no safe default exists **and** the action would
   cause irreversible state, destructive action, credential use, schema change,
   production deploy, force push, or a major architectural commitment.
4. When asking is required, ask one specific bounded question with a recommended
   default.

Do not pause for routine naming, style, file placement, implementation approach,
review-loop, validation, or CLI execution decisions.

---

## No-leftovers rule

Agents and CLIs must never leave unfinished work behind.

Forbidden in code, tests, docs, and configs:
- `TODO` / `FIXME` comments
- Placeholder implementations or stub functions
- No-op fallbacks presented as complete
- Skipped tests
- "implement later" notes
- Temporary hacks
- Dead files created for later use
- Partial wiring presented as complete

If a worker discovers required unplanned work:
1. Stop that worker.
2. Return an escalation to Fable 5 with: missing work, why it is required,
   affected files, risk level, and proposed acceptance criteria.
3. Fable 5 authors a full plan or micro-plan.
4. No Pi Code dispatch resumes until the new plan passes review.

---

## Behavioral rules

Apply to every plan, dispatch, review, validation, and shipping step.

**Think before coding.** Surface assumptions explicitly. If multiple
interpretations exist, pick the safest and note it. If a simpler approach
exists, choose it. Stop and ask only when ambiguity affects an irreversible
action.

**Simplicity first.** Write the minimum that solves the task. No speculative
flexibility, no abstractions for single-use code, no error handling for
impossible scenarios.

**Surgical changes.** Touch only files required by the task. Match existing
style. Remove only imports/variables/functions made obsolete by your own
changes. Every changed line must trace to this task.

**Goal-driven execution.** For every task define success criteria and
verification steps before execution:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```
Loop until verified. Do not claim success without evidence.

---

## Required preflight

Before writing docs or dispatching workers, verify or document setup for:

| Tool | Verify command |
|------|---------------|
| Claude Code | `claude --version` |
| oh-my-claudecode | `omc --version` |
| Headroom | `headroom --version` |
| claude-mem | MCP tool `memory_search` responds |
| Pi CLI | `pi --version` |
| Kimi | `kimi --version` |
| stop-slop skill | `ls ~/.claude/skills/stop-slop` |
| prompt-master skill | `ls ~/.claude/skills/prompt-master` |

**Model alias resolution (subagents):** when the session model carries a `[1m]`
suffix, subagent dispatches require a resolver env var. Set one of these in
`~/.claude/settings.json` under `"env"`:
```json
"ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
"ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-8",
"ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251001"
```
The OMC enforcer denies tier aliases it cannot resolve. Do not fake availability.

---

## Memory and context preflight

Before any planning or dispatch:
1. Search claude-mem for prior decisions, failures, conventions, and pitfalls:
   `memory_search("relevant topic")`, then inspect the timeline around hits,
   then fetch full observations only for selected IDs.
2. Use `headroom_compress` for large retrieved context; use `headroom_retrieve`
   before acting on any quoted file, command, or review finding (compressed
   context is a pointer, not proof).
3. Use `headroom_stats` to gauge available context budget.
4. Produce a short context brief with observation IDs when available.
5. Use `headroom learn` after any failed or corrected session to write durable
   corrections into `CLAUDE.md` or `AGENTS.md`.

---

## Planning loop

1. **Fable 5** authors the full plan (see Plan structure below).
2. **GPT-5.5** reviews it antagonistically (tool-less; all evidence embedded).
3. **Fable 5** revises based on findings. Blocking findings must be fixed;
   minor findings can be adjudicated with rationale.
4. Fable 5 checks the revised plan is actionable.
5. Repeat until no blocking findings remain. Max 3 cycles; after 3, log
   dispositions (FIXED / OVERRULED / FALSE) in `GATE-RESOLUTION.md`.

### Plan structure

- Objective
- Assumptions (explicit, not silent)
- Decisions made by Fable 5 and why
- Ambiguities requiring human input (only if no safe default exists)
- Scope + non-goals
- Task graph with per-task model routing
- Required micro-plans before each Pi Code dispatch
- Acceptance criteria
- Validation commands
- Review gates
- Stop conditions
- Rollback notes
- No-leftovers enforcement statement

---

## Micro-plan gate (required before every Pi Code dispatch)

Pi Code dispatch is **forbidden** until a micro-plan exists for the task.

Micro-plan must contain:
- Task ID and objective
- Assumptions
- Fable 5 decision and rationale
- Ambiguities, or confirmation that none block execution
- Model to run
- Exact prompt to send
- Files and directories in scope
- Files and directories forbidden
- Allowed commands
- Expected output artifact
- Acceptance criteria
- Validation command
- Stop conditions
- Context handoff source (Headroom SharedContext or claude-mem observation ID)
- Confirmation that no TODOs, placeholders, skipped tests, or deferred work
  are allowed in the output

---

## Implementation loop

1. **M3** implements exactly one approved micro-plan via Pi Code.
2. If M3 finds required unplanned work → stop and escalate to Fable 5
   (see No-leftovers rule above).
3. **Kimi** reviews the implementation (deep code review; never reviews its
   own commits).
4. **GPT-5.5** performs adversarial review (tool-less; embed full diff and
   plan in prompt; chunk diffs >~128 KB to avoid E2BIG).
5. Fable 5 verifies the implementation matches the approved plan and contains
   no leftovers.
6. If any blocking issue: Fable 5 authors a fix micro-plan → M3 executes it.
7. Repeat until Kimi, GPT-5.5, and Fable 5 all pass.

---

## Validation loop

1. **M2.7 Highspeed** runs validation via Pi Code.
2. Run available checks in order: lint → typecheck → unit tests → integration
   tests → build → smoke check.
3. Use `headroom_compress` for long logs; retrieve exact failing sections before
   diagnosing.
4. Store recurring failures and fixes in claude-mem for future sessions.
5. If validation fails → Fable 5 authors a fix micro-plan before any further
   Pi Code dispatch.
6. If validation reveals unplanned required work → escalate to Fable 5.

CortexOS validation commands (repo root):
```bash
pnpm exec eslint .                         # must exit 0, zero output
pnpm run format:check                      # must exit 0
pnpm --filter @cortexos/dashboard-next typecheck
set -a; source .secrets/dashboard.env; set +a
pnpm --filter @cortexos/dashboard-next test   # must be 619/619 PASS (or higher)
pnpm audit --audit-level=moderate          # 1 low @ai-sdk/provider-utils is the allowed baseline
```

---

## Shipping loop

1. **M2.7 Highspeed** drafts the commit message via Pi Code.
2. Fable 5 reviews the final diff before commit.
3. M2.7 commits and pushes **only after** validation passes.
4. **Stop before:** destructive git operations, force pushes, schema migrations,
   production deploys, or credential changes — confirm with the human first.
5. Record final decisions, validation evidence, and lessons in claude-mem.
6. Run `headroom learn` if the session had corrections or failed loops.

---

## oh-my-claudecode usage

| Skill / command | When to use |
|-----------------|-------------|
| `/team` | In-session staged orchestration across Claude Code panes |
| `/ralplan` | High-risk planning consensus (antagonist + advisor pass) |
| `/ask` / `omc ask` | Advisor artifacts for specific questions |
| `/ccg` | Multiple model perspectives need synthesis |
| `/ultraqa` | Repeated quality-gate loops |
| `/ralph` | Persistent verified completion — keeps running until done |
| `/skill` | Inspect installed skills |
| `/skillify` | Extract reusable workflows from session work |

**Do not use** `omc team` (tmux panes) when background-process-only workers are
required. Prefer Claude Code background agents, Pi Code background jobs, or
OMC in-session skills instead.

---

## Claude Code usage

- Put durable shared instructions in `AGENTS.md`.
- Keep `CLAUDE.md` as a thin `@AGENTS.md` import; add Claude-specific rules
  below only when necessary.
- Use `.claude/agents/` for project subagents; `~/.claude/agents/` for
  user-wide subagents.
- Use `.claude/rules/` for path-scoped rules (only if the repo already uses it).
- Use subagents for focused research, planning, review, and verification.
- Use background agents for independent full-session work.
- Use agent teams only when enabled and inter-worker communication is needed.
- Require plan approval before risky implementation.
- Clean up teams through the lead session only.

---

## Gate ledger

Maintain `.planning/GATE-RESOLUTION.md` (force-add with `git add -f`, since
`.planning/` is gitignored). Each plan-gate cycle entry records:
- Date and plan ID
- Critic findings per cycle (BLOCKER / MAJOR / MINOR)
- Disposition for each finding (FIXED / OVERRULED / FALSE) with rationale
- Final verdict and push evidence

---

## Stop conditions

Stop and ask the human before:
- Deleting any file outside the current plan's file-ownership section
- Adding a dependency
- Changing package manager config
- Modifying database schema
- Force pushing
- Deploying to production
- Touching files outside the declared scope
- Embedding credentials
- Dispatching Pi Code without a plan or micro-plan
- Any action with no safe autonomous default and an irreversible outcome
