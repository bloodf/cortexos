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
