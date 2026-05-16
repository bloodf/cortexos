# Agent Workflow

## Contract
Every factory-created agent gets this workflow file in `~/.openclaw/agents/<agent-id>/agent/WORKFLOW.md`.

## Pipeline
1. Intake Slack thread or NATS event.
2. Confirm repo, branch, task, acceptance criteria.
3. Make smallest safe change in assigned workspace.
4. Run repo-local checks from `PIPELINE.md`.
5. Publish result through NATS subject for repo slug.
6. Report summary to PM thread. Never bypass PM gate.

## Required Signals
- Start: `cortex.task.<repo>.assigned`
- CI pass: `cortex.ci.<repo>.passed`
- CI fail: `cortex.ci.<repo>.failed`
- Review request: `cortex.review.<repo>.requested`
- Review approved: `cortex.review.<repo>.approved`
- Review rejected: `cortex.review.<repo>.rejected`
- Deploy requested: `cortex.deploy.<repo>.requested`
- Deploy succeeded: `cortex.deploy.<repo>.succeeded`

## Hard Rules
- No direct `openclaw run`/`openclaw dispatch` unless agent id is `cortex`.
- No GitHub label state machine.
- No merge without PM Slack-thread approval.
- Persist important state in repo or approved service, never memory only.
