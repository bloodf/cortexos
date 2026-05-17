# Cortex Orchestration Templates

Local CI/CD + agent message bus. Replaces GitHub Actions. See [`docs/CORTEX-ORCHESTRATION.md`](../../docs/CORTEX-ORCHESTRATION.md) for the full design.

## Layout

```text
templates/cortex-orchestration/
  bin/
    cortex-bus          NATS CLI wrapper (pub/sub/streams/consumers)
    cortex-flux         DuckFlux v0.7 workflow runner (V0 bash subset)
    cortex-bus-init     Provision canonical streams + consumers (idempotent)
  examples/
    example-workflow.yml             Generic Node CI + Terraform deploy
  install.sh             Provisions /opt/cortex on the VPS
  README.md              this file
```

## Quickstart on the VPS

```bash
# 1. Bring up NATS via infra compose
cd /opt/cortexos
docker compose -f templates/docker-compose.infra.yml up -d nats

# 2. Install cortex tools + create streams
bash templates/cortex-orchestration/install.sh

# 3. Smoke pub/sub
cortex-bus tap 'cortex.>' &
TAP=$!
cortex-bus pub cortex.system.heartbeat '{"ts":"now","note":"smoke"}'
sleep 1; kill $TAP

# 4. Run a workflow
cp templates/cortex-orchestration/examples/example-workflow.yml /tmp/wf.yml
cortex-flux /tmp/wf.yml --input branch=main --input ref=HEAD --no-bus
```

## Adding a workflow to a repo

```bash
mkdir -p .cortex
cp /opt/cortexos/templates/cortex-orchestration/examples/<your-template>.yml .cortex/workflow.yml
git add .cortex/workflow.yml
git commit -m "ci: adopt cortex-flux workflow"
git push
```

A push triggers `gh-bus` (next iteration) → `cortex-flux` execution → status posted to GH commit + Slack + Telegram.

## DuckFlux subset supported in V0

✅ exec, emit | sequential, parallel, if/then/else | inputs (default + override) | inline + reusable participants | `workflow.inputs.<key>` CEL | per-stage `image` (docker) + `cwd` + `timeout`

🚧 Future: http, mcp, sub-workflows, loop, retry, full CEL, when guards, retry-with-backoff, output schemas

## Bus subjects (cheat sheet)

```text
cortex.workflow.<repo>.run.{started,stage,completed,failed}
cortex.workflow.<repo>.deploy.{started,completed,failed,rollback}
cortex.agent.<id>.{inbox,outbox}
cortex.agent.task.{queue,claimed.<id>,result.<id>}
cortex.gh.event.<repo>
cortex.label.<repo>.<num>
cortex.system.{heartbeat,error}
```

Tap everything: `cortex-bus tap 'cortex.>'`
