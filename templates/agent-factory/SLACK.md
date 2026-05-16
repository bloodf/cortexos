# Slack Thread Protocol

CortexOS uses one Slack bot for all project agents. The bot must organize visibility by channel and thread, not by posting a new top-level message for every update.

## Channel map

Configure project-to-channel routing in runtime secrets/config, not in this public template.

Example shape:

- `{project_a}`: `#{project_a_channel}`
- `{project_b}`: `#{project_b_channel}`
- `{project_c}`: `#{project_c_channel}`

If Slack channel IDs are known, prefer IDs in runtime config. If only names are configured, resolve them once and cache the IDs.

## Thread model

CortexOS uses two visible thread types:

1. **Issue thread** — create one root Slack channel message for each new GitHub issue.
2. **PR thread** — create a second root Slack channel message when a PR is opened for that issue.

Rules:

- All issue triage, planning, assignment, and pre-PR work stays in the issue thread.
- Once a PR exists, all PR review, CI, fix, approval, merge, and close updates stay in the PR thread.
- Do not create a new top-level channel message for every update.
- Store each Slack `channel` + `thread_ts` separately in runtime state:
  - issue key: `{repo}#issue-{issue_number}`
  - PR key: `{repo}#pr-{pr_number}`
- Link issue and PR threads to each other in their root messages.

Issue root message format:

```text
🧵 CortexOS issue — {repo} #{issue_number}

Title: {issue_title}
Issue: {issue_url}
Stage: {stage_label}
Owner: <@{owner_slack_user_id}>

All issue planning and pre-PR agent updates stay in this thread.
```

PR root message format:

```text
🚀 CortexOS PR — {repo} #{pr_number}

Title: {pr_title}
PR: {pr_url}
Issue: {issue_url}
Stage: {stage_label}
Owner: <@{owner_slack_user_id}>

All PR review, CI, fix, approval, merge, and close updates stay in this thread.
```

Thread reply format:

```text
{agent_emoji} {agent_name} — {stage_or_role}

{short_update}

Links: {issue_url_or_pr_url}
Next: {next_action_or_blocker}
```

## Approval handling

Slack can be a visibility surface and a control surface.

Accept approval in either form:

- Button: `Approve / Merge`
- Text in the issue thread: `APPROVE`, `APPROVED`, or `MERGE`

Accept rejection in either form:

- Button: `Reject / Restart`
- Text in the issue thread: `REJECT`, `REJECTED`, or `REJECT: {reason}`

When approved:

1. Merge the PR.
2. Close the linked issue.
3. Post the final result in the PR thread.
4. Post a short final cross-link in the issue thread.

For direct-to-main CI fixes, there may be no PR. In that case, approval is not required; post the commit SHA and CI status in the issue thread, then close the issue once CI is green.

## AI PR review gate

Every new PR must wait for Codex, Claude, and Cursor review integrations before the agent proceeds past review handling.

Required loop:

1. Request Codex, Claude, and Cursor reviews in the PR.
2. Post in the PR Slack thread that the agent is waiting for all three AI reviewers.
3. Wait until all three have completed their comments or status signal.
4. Evaluate every comment.
5. Fix valid comments with commits pushed to the PR branch.
6. Reply to or resolve addressed comments when the platform allows it.
7. Explain any rejected/invalid comments with a clear reason in the PR thread and PR comments.
8. Re-run CI and continue the pipeline only after review feedback is handled.

## Secret handling

Never commit Slack tokens. Store runtime tokens only in ignored secrets/config locations, for example:

- `.secrets/cortex-credentials.md`
- `/opt/cortexos/cicd/secrets/slack.env`

Required environment variables at runtime:

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-... # only required for Socket Mode/event ingestion
OWNER_SLACK_USER_ID=U...
```

If a token is ever pasted into chat, logs, issues, PRs, or committed files, rotate it.
