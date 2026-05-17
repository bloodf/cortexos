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

## NATS Publish Contract

Pre-push must publish exactly one CI event:

Success:

```bash
nats pub cortex.ci.<repo>.passed '{"repo":"<repo>","sha":"'"$(git rev-parse HEAD)"'","ts":"'"$(date -Is)"'"}'
```

Failure:

```bash
nats pub cortex.ci.<repo>.failed '{"repo":"<repo>","sha":"'"$(git rev-parse HEAD)"'","ts":"'"$(date -Is)"'","tail":"check failed"}'
```

## Factory Install Rule

Agent factory must copy `WORKFLOW.md` and `PIPELINE.md` into every new agent directory and install repo workflow files into every target repo before marking agent healthy.
