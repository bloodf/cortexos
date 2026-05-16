# CortexOS Slack Integration

Use one Slack app/bot for all agents. Organize traffic by project channels and GitHub issue/PR threads.

## Channels

Configure channel names/IDs in runtime secrets/config, not in this public repository.

Example:

- `#project-a`
- `#project-b`
- `#project-c`

## Runtime requirements

Secrets are not stored in git. Put them in the VPS/runtime secret store, for example `/opt/cortexos/cicd/secrets/slack.env`:

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-... # Socket Mode only
OWNER_SLACK_USER_ID=U...
```

If the bot only posts outbound updates, `SLACK_BOT_TOKEN` is enough. If Slack replies/buttons should trigger actions, enable Socket Mode and provide `SLACK_APP_TOKEN`, or configure public request URLs and provide the signing secret.

## Thread rule

The bot posts visible root messages only for major work objects:

1. One root channel message per GitHub issue.
2. One new root channel message when a PR is opened.

Issue planning/pre-PR updates go in the issue thread. PR review, CI, fixes, approval, merge, and close updates go in the PR thread.

No per-update top-level channel spam.

## AI PR review behavior

Each new PR must wait for Codex, Claude, and Cursor to complete their comments. Agents then evaluate all feedback, fix valid comments, commit/push updates, and resolve/reply to addressed comments before continuing.

## Approval behavior

In the PR thread, the owner can approve by button or text:

- `APPROVE`
- `APPROVED`
- `MERGE`

Reject by button or text:

- `REJECT`
- `REJECT: {reason}`

For PR workflows, approval merges the PR and closes the issue. For direct-to-main CI fixes, the agent posts the commit SHA and CI status, then closes the issue when CI is green.
