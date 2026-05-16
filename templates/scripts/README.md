# templates/scripts/

Phase 4b scaffolding scripts. Bash, `set -euo pipefail`, macOS bash 3.2 compatible.

## Scripts

### `bootstrap-project.sh`
Bootstraps a project repo with `.agents/<role>/` from `templates/agent-factory/` + `templates/agent-roles/`.
Idempotent — existing files are left intact; new candidates land as `<file>.new` with a warning.

```bash
./templates/scripts/bootstrap-project.sh \
  --project example-project \
  --repo-path ~/dev/example-project \
  --roles CEO,CTO,PM,PO,QA,UXUI,ENG-BACKEND,ENG-FRONTEND \
  --theme "example project theme" \
  --emoji "✨" \
  --lang typescript --framework next --db postgres \
  --deployment railway --infra docker
```

Placeholders substituted in every copied file:
`{agent_name} {agent_emoji} {theme} {project} {owner_name} {owner_telegram_chat_id}
{model} {language_default} {language_technical} {lang} {framework} {deployment}
{db} {infra} {role}`

Role file resolution: `templates/agent-roles/<ROLE>.md` → falls back to `ENGINEER.md` for
`ENG-BACKEND`, `ENG-FRONTEND`, `ENG-MOBILE` and unknown roles.

### `teardown-project.sh`
Re-runnable Phase 1 teardown per project.

```bash
./templates/scripts/teardown-project.sh \
  --project example-project \
  --backup-dir ~/backups/agents \
  --vps-host cortex
```

Steps:
1. Tarball `<repo>/.agents/` → `<backup-dir>/<project>-agents-<ts>.tgz`
2. SSH backup `~/.openclaw/openclaw.json`
3. List + delete agents matching `<project>-*` via `openclaw agents delete`
4. Strip cron jobs and bindings
5. Purge sqlite rows `WHERE agent_id LIKE '<project>-%'` across `~/.openclaw/*.db`
6. `rm -rf ${CORTEX_WORKSPACE_ROOT}/<project>`

### `regenerate-agents-md.sh`
Re-applies templates onto an existing `.agents/` tree.
`MEMORY.md` and `HEARTBEAT.md` are preserved (only restored if missing).
All other factory files + `ROLE.md` get rewritten with current placeholder values.

```bash
./templates/scripts/regenerate-agents-md.sh \
  --project example-project --repo-path ~/dev/example-project \
  --theme "example project theme" --emoji "✨" \
  --lang typescript --framework next
```

### `verify-pipeline.sh`
PASS/FAIL audit. Non-zero exit on any failure.

```bash
./templates/scripts/verify-pipeline.sh \
  --project example-project --repo-path ~/dev/example-project \
  --vps-host cortex
```

Checks:
- `.agents/` exists with role dirs
- 14 required files per role: SOUL, IDENTITY, USER, BOOTSTRAP, MEMORY, HEARTBEAT,
  AGENTS, CI_POLICY, TELEGRAM_APPROVAL, TOOLS, ESCALATION, STACK, PIPELINE, ROLE
- `.github/labels.yml` matches `templates/labels.yml`
- Required workflows present
- Repo-root `AGENTS.md` + `CLAUDE.md`
- (VPS) openclaw agents, bindings, cron, telegram routes

## chmod

After pulling, make executable:

```bash
chmod +x templates/scripts/*.sh
```

## Notes

- All scripts accept `--dry-run` where mutations occur.
- Sed substitution is portable (no GNU-only flags); placeholder values are escaped for `/` and `&`.
- Workers/agents never run git; orchestrator handles commits.
