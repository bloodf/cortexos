# cortex-graph — LangGraph sidecar (native)

## Purpose

Deploy the `cortex-graph` LangGraph sidecar as a native Python venv + systemd service. It owns resumable agent state with Postgres checkpoints for roles whose template frontmatter sets `graphEnabled: true`.

## Prerequisites

- `14-postgresql.md` completed.
- `30-nats.md` completed.
- `12a-sops-bootstrap.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — Postgres and NATS reachable on loopback
- [ ] Replay migration 007 from `packages/cortex-dashboard/migrations`
- [ ] Decrypt `graph.env` to `/opt/cortexos/.secrets/graph.env`
- [ ] Copy `stacks/cortex-graph` to `/opt/cortexos/stacks/cortex-graph`
- [ ] Create Python 3.13 venv and `pip install -e .`
- [ ] Install `templates/systemd/cortex-graph.service`
- [ ] Confirm `/healthz` returns ok and bearer probe pauses at human review
- [ ] Write graph-enabled roster for consumer
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Do `pg_isready -h 127.0.0.1 -p 5432` and `nc -zv 127.0.0.1 4222` both succeed?

Type `confirmed` to proceed.

## Apply migration 007

```bash
psql -v ON_ERROR_STOP=1 -U dashboard -h 127.0.0.1 cortex_dashboard \
  < packages/cortex-dashboard/migrations/007_langgraph_checkpoints.sql
psql -U dashboard -h 127.0.0.1 cortex_dashboard \
  -c "select name from migrations where name = '007_langgraph_checkpoints';"
```

Expected: one row.

## Install

```bash
bash /opt/cortexos/scripts/secrets-decrypt.sh graph
sudo chmod 600 /opt/cortexos/.secrets/graph.env

sudo install -d -m 0755 /opt/cortexos/stacks/cortex-graph
sudo cp -a stacks/cortex-graph/. /opt/cortexos/stacks/cortex-graph/
sudo chown -R "$USER:$USER" /opt/cortexos/stacks/cortex-graph
cd /opt/cortexos/stacks/cortex-graph
python3.13 -m venv .venv || python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -e .

sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-graph.service /etc/systemd/system/cortex-graph.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-graph
```

`graph.env` must use loopback endpoints for the native service:

```bash
PG_DSN=postgresql://dashboard:<pw>@127.0.0.1:5432/cortex_dashboard
NATS_URL=nats://127.0.0.1:4222
CORTEX_GRAPH_NATS_ENABLED=1
```

## Verify

```bash
curl -fsS http://127.0.0.1:8090/healthz
TOKEN=$(sudo grep '^CORTEX_GRAPH_API_TOKEN=' /opt/cortexos/.secrets/graph.env | cut -d= -f2-)
curl -fsS -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"role":"PM","issueId":"probe-1","input":{"title":"probe"}}' \
  http://127.0.0.1:8090/graph/runs
```

Expected: health OK and run body containing `"status":"interrupted"`.

## Wire cortex-consumer

```bash
sudo tee -a /opt/cortexos/.secrets/consumer.env <<EOF
CORTEX_GRAPH_URL=http://127.0.0.1:8090
CORTEX_GRAPH_API_TOKEN=${TOKEN}
EOF

sudo install -d -o root -g root -m 0755 /opt/cortexos/templates/agent-roles
sudo tee /opt/cortexos/templates/agent-roles/.graph-enabled.json <<'EOF'
["eng-backend"]
EOF
sudo chmod 0644 /opt/cortexos/templates/agent-roles/.graph-enabled.json

sudo systemctl restart cortex-consumer 2>/dev/null || true
```

## CHECKPOINT 2

**STOP — operator question:** Does `/healthz` return OK, does the bearer probe return `"status":"interrupted"`, and does `.graph-enabled.json` contain a non-empty JSON array?

Type `confirmed` to proceed.

## Rollback

```bash
sudo systemctl disable --now cortex-graph
# Optional — destroys checkpointed run state:
psql -U dashboard -h 127.0.0.1 cortex_dashboard \
  < /opt/cortexos/packages/cortex-dashboard/migrations/007_langgraph_checkpoints.rollback.sql
```

## Next

→ `prompts/tools/46-openclaw-codex-watchdog.md`
