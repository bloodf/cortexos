# Agent Pipeline

## Required Files Per Managed Repo

- `.husky/pre-commit`
- `.husky/pre-push`
- `AGENTS.md`
- `.github/workflows/agent-mention-router.yml`
- `.github/workflows/workflow-pipeline.yml`
- `.github/workflows/gate-enforcement.yml`

## Required Checks

Use repo-native commands, in this order:

1. format check, when available
2. lint
3. typecheck, when available
4. tests
5. build, when available

## PR AI Review Gate

When an agent opens or updates a pull request, the PR is not ready for human
review until the installed AI reviewers have had time to respond and every
actionable finding has been handled.

Required loop:

1. Open or update the PR with the commands run and known verification gaps.
2. Wait at least 15 minutes for GitHub App reviewers to post results.
3. Check the PR for review comments, review threads, check annotations, and top-level comments from CodeRabbit, Codex Review, and Claude Review. If the repo also has Cursor Review/Bugbot, include it in the same pass.
4. Fix every valid finding, commit the fixes, and push the same PR branch.
5. Reply to or resolve each addressed review thread. If a finding is invalid, explain why in the PR instead of ignoring it.
6. Request another review pass when needed and repeat the loop until there are no unresolved AI-review comments or requested changes.
7. Only then mark the PR ready for human review.

Do not label, comment, or otherwise present a PR as human-review-ready while
CodeRabbit, Codex Review, or Claude Review still has unresolved actionable
feedback.

## Project Verification Boundaries

- On Linux/headless runners, React Native E2E is Android-only. Do not run iOS
  simulator, Xcode, iOS archive, or iOS E2E flows unless the owner explicitly
  provides a macOS/iOS runner and asks for it.
- The first application-layer validation target for mobile work is Android in
  all managed product repos.
- For 3Guns hardware work, do not run physical hardware, serial/USB flashing,
  HIL, relay/pyro, or device-attached tests unless the owner explicitly asks and
  provides the hardware context. Prefer host/unit/protocol/static checks.

## Paperclip Completion Contract

Every run must leave a concise Paperclip issue comment containing:

- changed files or "no files changed"
- commands run
- pass/fail result
- remaining risk or follow-up, if any

The Paperclip issue status is the workflow state. Do not publish extra workflow
events or depend on separate workflow daemons.

## Factory Install Rule

Agent factory must copy `WORKFLOW.md` and `PIPELINE.md` into every new agent directory and install repo workflow files into every target repo before marking agent healthy.
