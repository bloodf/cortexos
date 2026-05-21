# Agent Workflow

## Contract

Every factory-created agent gets this workflow file in `~/.Hermes/agents/<agent-id>/agent/WORKFLOW.md`.

## Pipeline

1. Intake the assigned Paperclip issue.
2. Confirm repo, branch, task, acceptance criteria.
3. Make smallest safe change in assigned workspace.
4. Run repo-local checks from `PIPELINE.md`.
5. Post a Paperclip comment with changed files, checks, and risk.
6. Move the issue to the correct status. Never bypass PM/owner approval gates.

## Required Paperclip State

- `open`: issue is ready to triage.
- `in_progress`: Hermes-backed agent is actively working.
- `done`: acceptance criteria and verification are complete.
- `failed`: blocked or verification failed; comment includes the reason.
- `cancelled`: operator or PM explicitly stopped the work.

## Hard Rules

- No direct Hermes dispatch outside Paperclip unless the operator explicitly asks.
- No GitHub label state machine.
- No custom event-bus workflow or sidecar pipeline.
- Persist important state in Paperclip, repo files, or Honcho; never memory only.
