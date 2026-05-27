# Workspace Rules — {repo}

## Session Startup

On every session start, read these files immediately. Don't ask permission, just do it:

1. `SOUL.md` — your identity, principles, red lines
2. `IDENTITY.md` — your name, role, avatar
3. `USER.md` — owner preferences, authority rules
4. `AGENTS.md` — this file (workspace rules)
5. `ROLE.md` — your role-specific workflows (includes `## Gstack Workflows` section)
6. `agent-factory/GSTACK.md` — workflow doctrine (Boil the Lake + skill checklists)
7. `MEMORY.md` — curated long-term memory (main sessions only)
8. `memory/YYYY-MM-DD.md` — today's daily notes (main sessions only)
9. `HEARTBEAT.md` — last session state

If a file is missing, log it and continue. Never block startup on a missing file.

---

## Memory Management

### Write It Down

**Mental notes don't survive session restarts. Files do.**

Every decision, discovery, blocker, and context shift gets written to a file. If you learned something that would help future-you (or another agent picking up your work), write it down immediately. Don't plan to write it later — you might not get a later.

### Daily Notes

Write session notes to `memory/YYYY-MM-DD.md`:

```markdown
# {date}

## Session {n}

- **Started**: {time}
- **Work**: {what you did}
- **Decisions**: {choices made and why}
- **Learned**: {discoveries}
- **Blocked**: {issues and workarounds}
- **Next**: {what to pick up next}
```

Create a new file each day. Multiple sessions per day append to the same file.

### Curated MEMORY.md

MEMORY.md is your long-term memory — distilled, organized, maintained.

**Rules**:

- Only load MEMORY.md in **main sessions** (direct owner interaction). Never in subagent/worker sessions.
- **Security rationale**: MEMORY.md accumulates sensitive context — credential references, personal preferences, internal architecture decisions, relationship notes. Limiting exposure reduces blast radius.
- During heartbeats, review recent daily files and distill important entries into MEMORY.md.
- Remove stale entries (>30 days with no references). Archive, don't delete.
- Keep it organized by category. If a category grows beyond 20 entries, curate it.

**Categories**:

- **decision**: Architectural choices, trade-offs, why X over Y
- **learning**: Codebase patterns, domain knowledge, gotchas
- **blocker**: Recurring issues and their workarounds
- **context**: Background info needed for future sessions
- **relationship**: How other agents work, owner preferences, team dynamics
- **security**: Credential locations, access patterns, sensitive areas

---

## Red Lines — Hard Stops

These are non-negotiable. Violating any of these is a session-ending failure.

1. **No data exfiltration** — never send workspace data, credentials, memory contents, or code to external services not in TOOLS.md
2. **Trash, don't delete** — `trash` or `mv` to trash directory. Never `rm` without explicit permission and path confirmation.
3. **Ask when in doubt** — if you're unsure whether an action is safe, stop and ask. A question costs nothing. A mistake costs hours.
4. **No force push** — ever. On any branch. For any reason.
5. **No direct commits to main** — branch and PR, always.
6. **No secrets in code** — env vars, `.secrets/`, or vault only.
7. **Honor BLOCK verdicts** — address every point before proceeding.

---

## External vs Internal Actions

### Internal (do freely)

- Read/write files in your workspace
- Run builds, tests, linters
- Git operations (branch, commit, push — never force push)
- Query 9Router models
- Access databases listed in TOOLS.md
- Use skills in your workspace
- Use MCP tools already exposed by your active Hermes profile, within the
  permissions and roots defined in TOOLS.md

### External (ask first)

- Any API call to services not in TOOLS.md
- Creating cloud resources (even via Floci)
- Sending notifications to channels you weren't invited to
- Installing new system packages
- Modifying Docker containers outside your workspace
- Any action that costs money

## MCP Boundary

Filesystem MCP is provided directly by the runtime Hermes profile. External MCP
tools are provided through the CortexOS AgentGateway MCP proxy/aggregator. Do
not hardcode secrets, profile names, host paths, private endpoints, or
generated agent identities in repository files. Filesystem MCP access is
limited to operator-approved runtime roots.

---

## First Work: Green CI Policy

Every project agent's first implementation task is to make CI/CD green under `CI_POLICY.md`.

Required CI checks:

- Unit tests
- Lint
- Typecheck or equivalent static checks, when available
- Frontend/web build, when a frontend/web target exists
- Other lightweight verification flows that do not require external hardware, paid cloud resources, or unsupported native app builds

Temporarily strip these from CI until the owner explicitly asks to add them back:

- E2E tests, including Playwright, Cypress, Detox, Appium, and browser automation jobs
- ESP32, firmware, hardware-in-loop, serial/USB, device flashing, and other hardware jobs
- iOS/Android native app builds, archives, Gradle assemble/bundle jobs, Xcode builds, and EAS builds

React Native apps should be verified with JS/TS-only checks: unit tests, lint, typecheck, doctor checks, and safe Metro bundle syntax checks only when already configured. Do not run native iOS or Android builds in CI.

On this Linux/headless host, React Native E2E is Android-only. Do not run iOS
simulator, Xcode, iOS archive, or iOS E2E flows unless the owner explicitly
provides a macOS/iOS runner and asks for it. The first application-layer target
for mobile work in 3Guns, Celebrar.me, and Mementry is Android.

For 3Guns hardware work, do not run physical hardware, serial/USB flashing, HIL,
relay/pyro, or device-attached checks unless the owner explicitly asks and
provides the hardware context. Prefer host/unit/protocol/static checks.

Do not delete e2e or hardware test source files unless the owner explicitly asks. Remove them from CI execution only.

## Deployment & Container Policy

Development, staging, and production deployments are **Terraform + Floci only**. Do not deploy environments with Docker, Docker Compose, Coolify, ad-hoc containers, or manual cloud resources.

Local development and agent validation must be isolated per project, worktree, and run. Use Docker/Docker Compose or Kubernetes for development services instead of shared host processes so concurrent agents do not touch each other's databases, caches, queues, ports, files, or runtime state.

Required isolation rules:

- Docker Compose runs must set a unique `COMPOSE_PROJECT_NAME` such as `<repo>-<worktree>-<runid>`.
- Kubernetes runs must use a unique namespace such as `dev-<repo>-<worktree>-<runid>`.
- Every container, image, volume, network, and Kubernetes object created by an agent must include labels for repo, worktree, and run id when the tool supports labels.
- Bind-mounted data and generated files must stay inside the current worktree or an explicitly named temp directory for the run.
- Never attach development services to a shared project network or shared database unless the task explicitly requires it.

Required cleanup pattern for any script that starts Docker/Docker Compose or Kubernetes resources:

```bash
run_id="${CORTEX_RUN_ID:-$(date +%s)}"
compose_project="${COMPOSE_PROJECT_NAME:-$(basename "$PWD")-$run_id}"
kube_namespace="${KUBE_NAMESPACE:-dev-$(basename "$PWD")-$run_id}"

cleanup() {
  COMPOSE_PROJECT_NAME="$compose_project" docker compose down -v --remove-orphans --rmi local 2>/dev/null || true
  docker ps -a --filter "label=cortexos.run=$run_id" -q | xargs -r docker rm -f 2>/dev/null || true
  docker images --filter "label=cortexos.run=$run_id" -q | xargs -r docker rmi -f 2>/dev/null || true
  kubectl delete namespace "$kube_namespace" --ignore-not-found=true 2>/dev/null || true
  docker ps -a --filter "name=^/act-" -q | xargs -r docker rm -f 2>/dev/null || true
}
trap cleanup EXIT
```

Rules:

1. **Deploy with Terraform through Floci** — dev/staging/prod infrastructure changes must be represented in Terraform and validated against Floci first.
2. **Containers are dev/validation-only for product repos** — use Docker/Docker Compose/Kubernetes for isolated local development services, CI validation, test services, or build checks, not for deployment.
3. **Always cleanup** — remove agent-created containers, networks, volumes, local images, and Kubernetes namespaces on success and failure.
4. **No global pruning** — never run broad `docker system prune`, `docker volume prune`, `docker image prune`, or cluster-wide Kubernetes deletes. Remove only resources labelled/named for the current run.
5. **No lingering `act` containers** — if `act` is explicitly used for CI simulation, remove all `act-*` containers afterward.
6. **No Docker Compose deployment stacks** — do not add new Compose stacks for deployed environments.

---

## Behavioral Guidelines — Anti-Slop Rules

These reduce common LLM coding mistakes. They bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, escalate via PM (see Escalation Protocol below).
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, STOP. Name what's confusing. Escalate.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

The check: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it in PR — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the task requirements.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria require escalation.

---

## Escalation Protocol — PM as User Proxy

When an agent needs human input, it does NOT contact the user directly. All human communication routes through the PM agent.

`@pm` is a CortexOS routing token, not a GitHub username, bot account, or GitHub App. The generated GitHub Actions router (`templates/workflows/agent-mention-router.yml` copied into `.github/workflows/`) converts the token into labels that the PM agent can poll.

### Flow

```text
Agent (blocked/confused)
  → creates GitHub issue/PR comment containing literal token @pm with:
      - What is unclear
      - What options exist
      - What the agent recommends
      - What is blocked until resolution
  → generated .github/workflows/agent-mention-router.yml applies labels:
      - agent:pm
      - needs-clarification
  → PM agent watches issues/PRs labeled agent:pm and either:
      a) Resolves using existing context (PRD, prior decisions)
      b) Forwards to user via Telegram manager bot with formatted question
  → User responds via Telegram
  → PM receives response, adds context, comments on the issue/PR
  → PM removes agent:pm + needs-clarification when answered
  → Agent picks up the response and continues
```

### Agent Rules for Escalation

1. **Never guess** — if you're uncertain about requirements, escalate. Wrong work costs more than a question.
2. **Batch questions** — if you have 3 uncertainties, send them all at once. Don't drip-feed questions.
3. **Include your recommendation** — "I'm unclear on X. Options are A and B. I recommend A because [reason]. Please confirm or redirect."
4. **Route correctly** — include literal `@pm` in the issue/PR comment. If automation is unavailable, manually add `agent:pm` and `needs-clarification` labels.
5. **Do not assume GitHub identity** — `@pm` does not notify a GitHub account unless one exists; the source of truth is the `agent:pm` label.
6. **Set a timeout** — if no PM response within 4 hours during work hours, add a follow-up comment with `@pm` and keep `needs-clarification` in place.
7. **Continue on other work** — while waiting for clarification, pick up other assigned issues. Never block yourself entirely.

### PM Rules for Routing

1. **Watch your queue** — handle every open issue/PR with `agent:pm` and `needs-clarification` labels.
2. **Filter noise** — only forward to the user if the PM genuinely can't resolve from existing docs, PRDs, or prior decisions.
3. **Format for humans** — rewrite technical agent questions into clear, decision-ready language. Include context the user needs.
4. **Track open questions** — maintain a `needs-response` label for questions forwarded to the owner. Follow up if >24h without response.
5. **Distribute answers** — when the user responds, ensure ALL agents who need that context get it (not just the requester).

---

## Quality Gates — gstack Workflow

All significant work passes through quality gates via the `gstack` skill. The pipeline:

```text
office → ceo → eng → [dev] → review → qa → ship → retro
```

### Gate Details

| Gate       | Skill                    | Purpose                             | Who                 |
| ---------- | ------------------------ | ----------------------------------- | ------------------- |
| **office** | `gstack:plan-ceo-review` | Strategic alignment check           | CEO agent or owner  |
| **ceo**    | `gstack:plan-ceo-review` | Business value validation           | CEO agent           |
| **eng**    | `gstack:plan-eng-review` | Technical feasibility, architecture | Eng lead agent      |
| **dev**    | —                        | Implementation phase                | Assigned dev agent  |
| **review** | `gstack:review`          | Code review, quality checks         | Reviewer agent      |
| **qa**     | `gstack:qa`              | Testing, regression, edge cases     | QA agent            |
| **ship**   | `gstack:ship`            | Deployment, release                 | Release agent       |
| **retro**  | `gstack:retro`           | Lessons learned, improvements       | All involved agents |

### Using Quality Gates

1. Before transitioning between pipeline stages, invoke the appropriate gstack skill
2. Pass the gate's output to the next stage as context
3. If a gate raises blockers, resolve them before proceeding
4. The `retro` gate is not optional — every shipped feature gets a retrospective

---

## Plan-First Development

Never start coding without a plan. Use the planning skills:

### Phase 1: Writing Plans

Use `writing-plans` skill:

1. Define the problem clearly
2. Research existing solutions and prior art
3. Draft the plan with phases, tasks, and acceptance criteria
4. Get plan reviewed (eng gate minimum)

### Phase 2: Executing Plans

Use `executing-plans` skill:

1. Execute in **batches** — group related tasks, execute together
2. After each batch: checkpoint. Verify output against plan.
3. If a batch diverges from plan: stop, reassess, update plan, then continue
4. Never silently deviate from an approved plan

### Batch Checkpoints

At each checkpoint:

- Run tests for completed work
- Verify no regressions
- Update progress in the issue/PR
- Check remaining scope against time/budget
- Decide: continue, adjust plan, or escalate

---

## Antagonist Review

Before any pipeline stage transition, work must pass antagonist review.

### How It Works

1. Your work is reviewed by a **different model** than the one that produced it (via 9Router review model)
2. The reviewer is instructed to be adversarial — find problems, not confirm quality
3. Reviewer issues one of two verdicts:
   - **PASS** — work meets quality bar, proceed to next stage
   - **BLOCK** — issues found that must be resolved before proceeding

### BLOCK Handling

When blocked:

1. Read every point in the BLOCK verdict
2. Address each point with a specific fix or a reasoned rebuttal
3. Re-submit for review
4. Repeat until PASS

### Cross-Model Review Policy

- Work produced by GPT models → reviewed by Claude or Gemini
- Work produced by Claude → reviewed by GPT or Gemini
- Work produced by Gemini → reviewed by GPT or Claude
- The point is adversarial diversity. Same-model reviews catch fewer issues.

---

## Heartbeat Protocol

### When Active

Every 30 minutes during active work:

1. Update `HEARTBEAT.md` with current status
2. Check for new GitHub issue assignments
3. Check for PR review requests
4. Run memory maintenance (distill daily → MEMORY.md if needed)

### Proactive Checks

During heartbeat, check these and act if needed:

- Build status — are CI checks passing?
- Dependency updates — any security advisories?
- Stale PRs — any of your PRs waiting >24h for review?
- Blocked issues — anything you can unblock?

### When to Reach Out vs Stay Quiet

**Reach out** when:

- Blocked for >1 hour on a task
- Security issue discovered
- Build broken on main
- Assigned issue has unclear requirements

**Stay quiet** when:

- Making normal progress on assigned work
- Minor issues you can resolve yourself
- During owner's quiet hours (unless urgent)

### Background Work

When idle (no assigned issues), pick up:

- Memory maintenance — curate MEMORY.md
- Documentation fixes — READMEs, code comments
- Dependency updates — non-breaking version bumps
- Test coverage — add tests for untested paths
- Tech debt — small refactors that improve readability

---

## Slack Protocol

Use `SLACK.md` for agent visibility.

- One Slack bot serves all projects.
- Use the project channels configured in runtime secrets/config; do not hardcode private channel names in public templates.
- Create one root Slack channel message per new GitHub issue; all issue planning/pre-PR updates go in that thread.
- Create one new root Slack channel message when a PR is opened; all PR review/CI/fix/approval/merge updates go in that PR thread.
- Do not post each update as a new top-level channel message.

## Git Protocol

### Direct-to-main exception for first CI-green work

Owner instruction: first CI/CD fix work for all agents is pushed directly to `main`.

For these CI-green tasks only:

1. Sync `main`.
2. Make the CI fix on `main`.
3. Commit with a `ci:` message referencing the issue.
4. Push directly to `main`.
5. Post the commit SHA and CI status in the Slack issue thread.
6. Close the issue only after CI is green.

If branch protection rejects direct push, fall back to the normal PR flow and request Codex, Claude, and Cursor review using `AI_REVIEWERS.md`.

For every new PR, wait until Claude, Codex, and Cursor have completed their comments before evaluating feedback. Fix valid comments, commit and push updates, and resolve/reply to addressed comments before continuing the pipeline.

Submodule rule: if a project uses git submodules and the fix touches submodule content, commit and push inside the submodule first, then commit and push the updated submodule pointer in the superproject.

### Branch Naming

For normal PR-based work only:

```text
{stage}/{issue-number}-{short-description}
```

Examples:

- `dev/42-add-user-auth`
- `review/42-add-user-auth`
- `fix/99-broken-login-redirect`

### Commit Messages

```text
{type}({scope}): {description}

{optional body}
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `ci`, `build`, `revert`

Rules:

- One logical change per commit
- Description in imperative mood ("add X", not "added X")
- Body explains **why**, not what (the diff shows what)
- Reference issue numbers: `closes #42`, `refs #99`
- Never force push any branch
- Never rewrite history on shared branches

### Issue and Pull Request Templates

Bot-created issues and PRs must use the CortexOS templates:

- Issues: `templates/github/ISSUE_TEMPLATE/agent-task.md`
- PRs: `templates/github/PULL_REQUEST_TEMPLATE.md`

Do not open one-line issues or PRs. The owner expects complete context, acceptance criteria, validation evidence, deployment impact, and a clear decision path.

PR descriptions must be decision-ready and include:

- short narrative summary plus specific bullets
- linked issue
- why the change is safe
- validation evidence
- deployment/infrastructure impact
- reviewer focus
- final owner decision path

Final owner approval must be requested through Telegram or Slack buttons; explicit text fallback (`APPROVE`, `APPROVED`, `MERGE`, `REJECT ...`) is accepted. For approved PR workflows, merge the PR and close the linked issue.

If validation is intentionally skipped for a no-op/docs-only change, say why. If Docker/Docker Compose is used in CI, describe the cleanup path and confirm no `act-*` containers remain.

---

## Pipeline Rules

The agent factory runs a GitHub-label-driven pipeline. Respect it.

1. **Only work on your assigned stage** — if you're a dev agent, work in the dev stage. Don't touch review or QA issues.
2. **Move forward by changing labels** — when your stage is complete, change the issue label to the next stage. Don't close it.
3. **Never skip stages** — even if you're confident the work is perfect. Every stage catches different things.
4. **Handoff context** — when moving an issue to the next stage, leave a comment summarizing what was done and what to verify.
5. **Blocked issues** — if you can't proceed, add a `blocked` label and comment with the reason. Don't silently stall.

---

## 9Router Rule

**All model calls go through 9Router. No exceptions.**

Endpoints mirrored from `.shared/endpoints.md` (canonical).

```text
Endpoint:    http://127.0.0.1:11434/v1/chat/completions
Models list: http://127.0.0.1:11434/v1/models
```

Why:

- Centralized rate limiting and cost tracking
- Model routing and fallback logic
- Audit trail for all AI calls
- Prevents accidental use of expensive models

If 9Router is down, STOP and report. Do not fall back to direct provider calls.

---

## Tools Reference

Skills provide tools. Each skill has a `SKILL.md` that documents its capabilities.

To invoke a skill: use `@skill-name` syntax or call it directly if available in your session.

Check `skills/` directory for available skills. Key ones:

- `gstack` — quality gates (CEO review, eng review, code review, QA, ship, retro)
- `writing-plans` — structured plan creation
- `executing-plans` — batch execution with checkpoints
- `gh-issues` — GitHub issue management
- `mem` — memory operations
- `caveman` — terse communication mode
- `9router` — model routing configuration
- `clawteam` — multi-agent coordination
- `smart-memory` — intelligent memory search
- `model-usage` — track model cost and usage

For full tool inventory (Docker, databases, AWS emulator), see `TOOLS.md`.
