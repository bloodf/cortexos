# GSTACK — Agent Workflow Doctrine

Source: gstack skill bundle (Garry Tan / X-Rite Pantone). Distilled for VPS agents.
Original skills run only inside Claude Code on a workstation. Agents follow the
**principles + checklists** here as written instructions.

---

## Core principle — Boil the Lake

AI-assisted work makes marginal cost of completeness near-zero.

- A **lake** is boilable: 100% test coverage for a module, full feature
  implementation, all edge cases, complete error paths. **Boil lakes.**
- An **ocean** is not: rewriting entire systems, multi-quarter migrations,
  changing dependencies you don't control. **Flag oceans as out-of-scope.**
- When presenting options, score each `Completeness: X/10`. Always recommend
  the complete option (10) over shortcuts unless an ocean is involved.
- Don't skip the last 10% to "save time" — with AI, that 10% costs seconds.

| Task type                 | Human team | AI agent  | Compression |
|---------------------------|-----------|-----------|-------------|
| Boilerplate / scaffolding | 2 days    | 15 min    | ~100x       |
| Test writing              | 1 day     | 15 min    | ~50x        |
| Feature implementation    | 1 week    | 30 min    | ~30x        |
| Bug fix + regression test | 4 hours   | 15 min    | ~20x        |
| Architecture / design     | 2 days    | 4 hours   | ~5x         |
| Research / exploration    | 1 day     | 3 hours   | ~3x         |

## When asking the owner (Telegram via PM)

1. **Re-ground**: project, branch, current task. 1-2 sentences.
2. **Simplify**: plain language a smart 16-year-old understands. No jargon.
3. **Recommend**: `RECOMMENDATION: A because <one-line>`. Include
   `Completeness: X/10` per option.
4. **Lettered options**: `A) ... B) ... C) ...` with effort estimate
   `(human: ~X / agent: ~Y)`.

---

## Workflows

### `review` — Pre-landing PR review

Trigger: PR opened, "review this PR", pre-merge gate.

Checklist:
1. Diff against base branch (`git diff origin/<base>...HEAD`).
2. SQL safety: parameterized queries only, no string interpolation, migrations
   reversible, no `TRUNCATE`/`DROP` without confirmation.
3. LLM trust boundary: any user input passed to LLM is sanitized; LLM output
   never trusted for auth/authz decisions or file paths.
4. Conditional side effects: any `if` that mutates state has corresponding
   rollback path.
5. Test coverage: every new branch covered, edge cases listed in test names.
6. No hardcoded secrets, no `.env` content committed.
7. Backward compatibility: API/schema changes documented.

Output: structured findings (CRITICAL / HIGH / MEDIUM / LOW), suggested fixes,
ship/no-ship verdict.

### `plan-eng-review` — Engineering plan review

Trigger: pre-implementation, architecture lock-in.

Walk through interactively:
- Architecture diagram (text), data flow, sequence of operations.
- Edge cases enumerated (empty, max, concurrent, failure, retry).
- Test plan: unit + integration + e2e listed with names.
- Performance: O(n) of hot paths, expected p99 latency, memory ceiling.
- Observability: logs, metrics, traces wired in.
- Rollback strategy.

Refuse to proceed if any dimension is < 7/10.

### `plan-ceo-review` — Founder-mode plan review

Trigger: "think bigger", strategy review, scope challenge.

Four modes:
- **SCOPE EXPANSION**: what would the 10-star version look like?
- **SELECTIVE EXPANSION**: hold scope, cherry-pick expansions worth doing.
- **HOLD SCOPE**: maximum rigor, no scope drift.
- **SCOPE REDUCTION**: strip to essentials, what can we kill.

Output: scope decision + rationale + owner sign-off request.

### `plan-design-review` — Design plan review

Trigger: design-phase plan, before UI build.

Rate each dimension 0-10:
- Visual hierarchy, typography system, color system, spacing/layout grid,
  motion language, accessibility, brand alignment, edge-case states (loading,
  empty, error, success), responsive breakpoints, dark mode.

For each < 10: explain what makes it a 10, fix the plan.

### `design-consultation` — Create design system

Trigger: greenfield project, "create DESIGN.md".

Output: `DESIGN.md` containing:
- Brand statement + 3 adjectives
- Typography (font family, scale, weights, line-heights)
- Color (primary, secondary, neutrals, semantic — with hex + a11y contrast)
- Spacing scale (4 / 8 / 16 / 24 / 32 / 48 / 64)
- Motion (durations, easings, named transitions)
- Layout grid + breakpoints
- Component primitives

### `ship` — Land code safely

Trigger: "ship", "create PR", "push to main".

Sequence:
1. `git status` clean check.
2. Detect base branch (`main` or `master`), pull, rebase.
3. Run full test suite. Block on red.
4. Review own diff (apply `review` workflow).
5. Bump VERSION (semver: patch by default).
6. Update CHANGELOG (one bullet per behavior change, user-facing voice).
7. Commit with conventional message (`type(scope): subject`).
8. Push branch.
9. Open PR with summary + test plan + screenshots if UI.
10. Post Slack thread with PR link (per ARCHITECTURE.md).
11. Wait for AI reviewers (Codex, Claude, Cursorbot, future CodeRabbit).
12. Fix all review findings, re-push.

Never push to `main` directly. Never force-push without owner approval.
Never `--no-verify` / `--no-gpg-sign`.

### `browse` — Headless browser for QA

Trigger: "open this URL", "test the site", visual verify.

Operations: navigate, click, fill, screenshot, network log, console log,
responsive viewport switch, dialog handling.

For agents: use `playwright` or `chrome-devtools` MCP (already installed per
TOOLS.md). Output: screenshot evidence + console errors + network failures.

### `qa` — Test-fix-verify loop

Trigger: pre-ship QA, "test and fix".

Three tiers:
- **Quick**: CRITICAL + HIGH bugs only.
- **Standard**: + MEDIUM.
- **Exhaustive**: + COSMETIC.

Loop:
1. Test the feature (golden path + edge cases).
2. Capture before-state health score (0-100).
3. For each bug found: file structured report (severity, repro, evidence).
4. Fix in source, commit atomically (`fix(scope): subject`).
5. Re-verify.
6. Capture after-state health score.
7. Report: before/after scores, fix list, ship-readiness verdict.

### `qa-only` — Report-only QA

Same as `qa` but **never fixes**. Produces structured report with health score,
screenshots, repro steps. For when triage > fix.

### `qa-design-review` — Live visual audit

Trigger: deployed UI, "design review the site".

Walk each page:
- Visual hierarchy clear (10 = obvious primary action).
- Typography consistent across components.
- Color usage matches DESIGN.md.
- Spacing rhythm holds.
- Interactive states (hover, focus, active, disabled) present.
- Empty / error / loading states designed.
- Responsive at 375 / 768 / 1280 / 1920.
- Dark mode parity.

Rate each 0-10. Recommend fixes for < 8.

### `retro` — Weekly engineering retro

Trigger: weekly cadence (cron Friday 18:00), "weekly retro".

Pull commit history for the week. Output:
- **What shipped**: per-feature one-liners.
- **Velocity**: commits/PRs/lines per author.
- **Code quality trend**: lint errors, test count, coverage delta.
- **Wins**: praise per-person (specific commits).
- **Growth areas**: per-person, kind+specific.
- **Patterns**: recurring bug classes, repeated review feedback.
- **Next week**: 3 priorities.

Post in Slack `#<project>` and Telegram to PM only.

### `document-release` — Post-ship docs sync

Trigger: after `ship` completes.

1. Re-read all `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `CLAUDE.md`,
   `AGENTS.md`.
2. Diff against what shipped.
3. Update each to match new state.
4. Polish CHANGELOG voice (user-facing, no "we" / "the team").
5. Clear stale TODOs.
6. Bump VERSION if not already done.

---

## Per-role applicability

| Role             | Primary skills                                                     |
|------------------|--------------------------------------------------------------------|
| CEO              | plan-ceo-review, retro                                             |
| CTO              | plan-eng-review, review, retro                                     |
| STAFF-ENG        | plan-eng-review, review, ship                                      |
| ENGINEER, ENG-*  | review, ship, document-release                                     |
| UXUI             | plan-design-review, design-consultation, qa-design-review          |
| QA               | qa, qa-only, browse, qa-design-review                              |
| PM               | ship, retro, document-release                                      |
| PO               | plan-ceo-review (selective), retro                                 |
| CORTEX           | retro, document-release, ship (gateway PRs)                        |
| ANTAGONIST       | review, plan-eng-review (adversarial mode)                         |
| BOOK-*           | (n/a — book agents follow BOOK-pipeline, not gstack)               |

---

## Integration with ARCHITECTURE.md

- `ship` step 10 (Slack thread post) is the **only** Slack write path for
  engineering work — PM owns the thread, engineers append.
- `qa` reports go to Slack thread + Telegram-to-PM if CRITICAL.
- `retro` Telegram delivery: PM agent only, via `openclaw-dispatch-pm`.
- AI reviewer responses (Codex/Claude/Cursorbot/CodeRabbit) wait-loop is
  inside `ship` step 11 — agents poll PR comments via `gh pr view`.

## Clawhub plugin pairings

| Plugin                          | Skill it amplifies                          |
|---------------------------------|---------------------------------------------|
| ivangdavila/self-improving      | retro (self-organizing memory)              |
| pskoett/self-improving-agent    | qa, review (learn from corrections)         |
| biostartechnology/humanizer     | document-release, retro (cleanup AI voice)  |
| steipete/github                 | ship, review (gh CLI native)                |
| @openclaw/lobster               | ship, qa (typed pipelines + approvals)      |

All 5 plugins installed fleet-wide. See `TOOLS.md` for plugin invocation.
