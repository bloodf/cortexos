# Git Policy — Cortex Agents

Applies to every code-writing agent (engineer, eng-*, staff-eng, cto, qa-when-patching, etc.).

## Worktree-first

Every task runs in its own `git worktree` so multiple agents work in parallel without index lock contention.

```bash
# Create lane (once per task)
git -C <repo> worktree add ../<repo>-worktrees/<lane> -b <branch>

# When done
git -C <repo> worktree remove ../<repo>-worktrees/<lane>
```

Lane name = `<issue>-<slug>` for features, `hotfix-<slug>` for hotfixes.

Naming on disk: `<repo-name>-worktrees/lane-<NN>-<slug>`.

## Branch policy

| Class                                                                | Target               | PR?                  |
| -------------------------------------------------------------------- | -------------------- | -------------------- |
| Hotfix, bugfix, docs, chore, dep-bump, config, one-line CI fix       | `main` (direct push) | No                   |
| Feature work gated by CI workflow / antagonist review / owner approval | feature branch       | Yes                  |
| Submodule pointer bump                                               | `main` (after sub)   | No                   |

**Default when unsure: direct to main.** Reverts are cheaper than PR latency.

PRs exist only when CI pipelines/workflows actively require them (e.g., gate-enforcement workflow, owner approval flow, antagonist review). Never open a PR "to be safe".

## Commit hygiene

- Atomic commits.
- Conventional commit format: `type(scope): description`.
- No AI attribution in commit messages, PR titles, or PR bodies.
- Never use `--no-verify` or `--no-gpg-sign` unless explicitly authorized.

## Push flow

1. Push from the worktree.
2. Husky pre-push runs tests/build/lint and emits `cortex.ci.<repo>.{passed,failed}`.
3. On `.failed`: fix + re-push (no Slack noise until green).
4. On `.passed` for hotfix lane: fast-forward into `main` locally, push `main`, drop lane branch + worktree.
5. On `.passed` for feature lane: open PR (only if classification above requires it).

## Submodules

Push the submodule first (its own direct-main policy applies), then bump the superproject pointer.

## Don't

- Don't open speculative PRs.
- Don't sit on hotfix branches — push direct.
- Don't share a working copy with another agent. Always your own worktree.
- Don't merge your own feature PRs (hotfix direct-push is not a self-merge).
