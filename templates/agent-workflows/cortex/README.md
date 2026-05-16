# Cortex Operations Agent Workflow

## Purpose

Run an always-on operations agent that keeps a CortexOS installation healthy: OpenClaw, model routing, memory, GitHub automation, dispatch, heartbeat, dashboard, and supporting services.

## Required Agents

- `cortex` or `main` using `templates/agent-roles/CORTEX.md`
- One PM agent for human/user-proxy routing
- Optional CTO/staff engineer agents for infrastructure review

## Required Services

- OpenClaw gateway and Mission Control
- 9Router model gateway
- OpenViking context database
- Hindsight memory service
- GitHub CLI authenticated for target repositories
- User-level systemd services for heartbeat and dispatch

## Installation

1. Copy `templates/agent-factory/*` into the Cortex agent workspace.
2. Copy `templates/agent-roles/CORTEX.md` as the role document.
3. Replace placeholders: `{repo}`, `{agent_name}`, `{model}`, `{openviking_port}`, `{hindsight_port}`.
4. Ensure the agent has read access to service status and write access only to approved config paths.
5. Install `templates/workflows/agent-mention-router.yml` into target repositories as `.github/workflows/agent-mention-router.yml`.
6. Install `templates/workflows/ai-review-request.yml` and `templates/github/AI_REVIEWERS.md` into target repositories for normal PR workflows.
7. Configure Slack from `SLACK.md`; set project channel names/IDs in runtime secrets/config, not in public templates.

## First Fleet Work: Green CI

Before feature work, create/route one CI-green issue per active project. The issue must instruct agents to follow [`docs/runbooks/CI_POLICY.md`](../../../docs/runbooks/CI_POLICY.md):

- Keep CI fast and green: unit tests, lint, typecheck/static checks, frontend/web build, and lightweight verifications.
- Strip e2e jobs from CI until the owner asks to restore them.
- Strip ESP32/firmware/hardware jobs from CI.
- Strip iOS/Android native mobile builds from CI.
- For React Native, use JS/TS-only verification; do not run Xcode, Gradle native builds, EAS builds, Detox, or device/simulator e2e.
- Push these first CI-green fixes directly to `main`; if branch protection blocks direct push, fall back to PR and request Codex, Claude, and Cursor review.
- For projects with git submodules, commit/push touched submodules first, then commit/push the updated superproject pointer.

## Daily Operating Loop

1. Check OpenClaw gateway, Mission Control, 9Router, OpenViking, Hindsight, and dashboard health.
2. Check dispatch and heartbeat recency.
3. Inspect failed GitHub workflow runs and blocked `agent:*` queues.
4. Repair safe drift and record changes in `HEARTBEAT.md`.
5. Escalate risky or product-affecting decisions through PM.

## Incident Loop

1. Confirm the failure with a command or health endpoint.
2. Snapshot logs and config before changing anything.
3. Apply one reversible fix.
4. Verify health.
5. Record root cause, fix, and prevention.

## Update Loop

1. Read release notes or changelog.
2. Create a backup.
3. Apply update in a maintenance window.
4. Run smoke tests for gateway, dispatch, PM routing, and dashboard.
5. Commit documentation/template updates if the process changed.

## Human Escalation

Use PM routing for questions. `@pm` is a routing token converted to `agent:pm` plus `needs-clarification`; it is not a required GitHub App.

## Health Checks

- `systemctl --user is-active openclaw-gateway`
- `systemctl --user is-active mission-control`
- `curl -fsS http://127.0.0.1:<gateway_port>/health`
- `gh issue list --label agent:pm --label needs-clarification`
- Dispatch dry run or heartbeat script output

## Copy Checklist

- [ ] Cortex role installed
- [ ] Factory files installed
- [ ] Secrets stored outside git
- [ ] OpenClaw gateway healthy
- [ ] PM routing workflow installed
- [ ] Dispatch and heartbeat enabled
- [ ] Rollback backup exists
