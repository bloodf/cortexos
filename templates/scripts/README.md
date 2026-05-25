# Template Scripts

These scripts generate or verify project scaffolding. They are generic by
design: no private project names, secrets, channel IDs, or hostnames belong in
this directory.

## Scripts

| Script | Purpose |
| --- | --- |
| `bootstrap-project.sh` | Create `.agents/<role>/` from `templates/agent-factory` and `templates/agent-roles`. |
| `regenerate-agents-md.sh` | Refresh generated agent files while preserving `MEMORY.md` and `HEARTBEAT.md`. |
| `verify-pipeline.sh` | Check that a generated project has the expected agent files and workflow templates. |
| `teardown-project.sh` | Remove a local project runtime after backup. Use with care. |
| `cortex-env-writer.sh` | Safely update allowed `/opt/cortexos/.secrets/*.env` keys from JSON input. |
| `test-9router.sh` | Verify model discovery through 9Router. |

## Usage

```bash
./templates/scripts/bootstrap-project.sh \
  --project example \
  --repo-path /path/to/example \
  --roles CEO,CTO,PM,ENG-BACKEND,ENG-FRONTEND,QA \
  --theme "example product" \
  --lang typescript \
  --framework next \
  --db postgres \
  --deployment docker \
  --infra docker
```

## Rules

- Scripts must be idempotent or provide `--dry-run`.
- Project-specific generated output stays in the project repo, not here.
- Runtime credentials stay in `/opt/cortexos/.secrets`.
- Do not hardcode private profile names, Slack channels, Telegram IDs, or
  machine hostnames.
- Workers/agents do not run Git commands; the operator handles commits.
