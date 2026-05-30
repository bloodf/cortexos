# AI PR Reviewers

Repos may have Codex, Claude, and Cursor review integrations installed. Use this file to keep review requests consistent.

## Required reviewers for PR workflows

For normal PR-based work, request all available AI reviewers:

```text
@codex review this PR for correctness, tests, CI impact, and hidden edge cases.
@claude review this PR for architecture, security, maintainability, and regression risk.
@cursor review this PR for code quality, framework usage, and practical implementation issues.
```

If a repository uses different trigger handles or slash commands, replace the lines above in that repo's copy of this file.

## Required wait-and-fix loop

After a PR is created:

1. Create a new Slack root message for the PR in the project channel.
2. Request Codex, Claude, and Cursor reviews.
3. Wait until all three integrations have finished commenting or posted their completion signal.
4. Evaluate every comment.
5. Fix every valid comment with a commit pushed to the PR branch.
6. Reply to or resolve addressed comments when the platform supports it.
7. For comments not applied, leave a short technical reason.
8. Re-run CI before moving the issue forward.

## Direct-to-main CI fixes

The first CI-green fix work is allowed to push directly to `main` by owner instruction. For direct-to-main work:

1. Post the intended change plan in the Slack issue thread before changing files.
2. Commit directly to `main` with a clear `ci:` commit message.
3. Push `main`.
4. Post the commit SHA and GitHub Actions run URL in the same Slack thread.
5. If CI fails, fix forward with another direct `main` commit.
6. Close the issue only after CI is green.

No PR review is required for this special first CI-green task unless branch protection blocks direct push.

## Git submodules

If a project uses git submodules and a CI fix touches submodule content:

1. Commit and push inside the affected submodule first.
2. Return to the superproject.
3. Commit and push the updated submodule pointer on `main`.
4. Include both SHAs in the Slack thread and GitHub issue comment.
