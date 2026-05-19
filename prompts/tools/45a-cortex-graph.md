# cortex-graph — LangGraph sidecar (V7)

## Purpose

Deploy the `cortex-graph` LangGraph sidecar that owns resumable agent
state with Postgres checkpoints. Becomes the execution engine for any
agent role whose template frontmatter sets `graphEnabled: true`.

See `docs/AGENT-GRAPH.md` for architecture and `stacks/cortex-graph/README.md`
for the developer surface.

## Prerequisites

- `14-postgresql.md` completed — checkpointer requires the shared
  `cortex-postgresql` instance (database `cortex_dashboard`, role
  `dashboard`).
- `30-nats.md` completed — bridge consumes `cortex.graph.invoke.>` and
  publishes `cortex.graph.state.<runId>`.
- `12a-sops-bootstrap.md` completed — `graph.env` must be decryptable
  via `scripts/secrets-decrypt.sh`.
- `60-cortex-consumer.md` completed — V7 consumer routes work into the
  sidecar when `CORTEX_GRAPH_URL` is exported.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```


## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Apply migration 007
- [ ] Decrypt graph.env
- [ ] Build + boot
- [ ] Verify
- [ ] Wire cortex-consumer
- [ ] Write the graph-enabled roster
- [ ] CHECKPOINT 2 confirmed
## CHECKPOINT 1

**STOP — operator question:** Postgres reachable at `127.0.0.1:5432`, NATS at?

1:5432`, NATS at
`127.0.0.1:4222`, and Docker daemon up.

Type `confirmed` to proceed.
## Apply migration 007

Migrations are dashboard-driven; the dashboard entrypoint replays
`migrations/*.sql` in lexical order on boot. Force-replay on the VPS:

```bash
docker compose -f /opt/cortexos/stacks/cortex-dashboard/docker-compose.yml \
  exec cortex-dashboard node scripts/migrate.js
```

Verify:

```bash
docker exec -it cortex-postgresql psql -U dashboard -d cortex_dashboard \
  -c "select name from migrations where name = '007_langgraph_checkpoints';"
```

Expected: one row.

## Decrypt graph.env

```bash
sudo CORTEXOS_SOPS_KEY="$(cat /opt/cortexos/.secrets/age.key)" \
  bash /opt/cortexos/scripts/secrets-decrypt.sh \
    /opt/cortexos/templates/.secrets/graph.enc.yaml \
    /opt/cortexos/.secrets/graph.env
sudo chmod 600 /opt/cortexos/.secrets/graph.env
```

`graph.env` must define:

```bash
CORTEX_GRAPH_API_TOKEN=<32+ hex chars; required>
PG_DSN=postgresql://dashboard:<pw>@cortex-postgresql:5432/cortex_dashboard
NATS_URL=nats://nats:4222
CORTEX_NATS_HMAC=<same key as cortex-consumer>
CORTEX_GRAPH_NATS_ENABLED=1
OTEL_EXPORTER_OTLP_ENDPOINT=<optional>
```

## Build + boot

```bash
cd /opt/cortexos/stacks/cortex-graph
docker compose up -d --build
docker compose ps
```

## Verify

```bash
curl -fsS http://127.0.0.1:8090/healthz
```

Expected: `{"status":"ok"}`.

Bearer-protected endpoint smoke (token from `graph.env`):

```bash
TOKEN=$(sudo grep '^CORTEX_GRAPH_API_TOKEN=' /opt/cortexos/.secrets/graph.env | cut -d= -f2-)
curl -fsS -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"role":"PM","issueId":"smoke-1","input":{"title":"smoke"}}' \
  http://127.0.0.1:8090/graph/runs
```

Expected: `200` with body `{"runId":...,"threadId":...,"status":"interrupted","nodeId":"human_review"}`.

## Wire cortex-consumer

Set on the consumer host (compose env or `.secrets/consumer.env`):

```bash
CORTEX_GRAPH_URL=http://127.0.0.1:8090
CORTEX_GRAPH_API_TOKEN=<same as graph.env>
```

Restart `cortex-consumer`. Roles with `graphEnabled: true` will now
dispatch via the sidecar; roles without the flag keep the legacy
direct path.

## Write the graph-enabled roster

`consumer.js` only dispatches to the sidecar when the role appears in
`/opt/cortexos/templates/agent-roles/.graph-enabled.json` (path
override: `CORTEX_GRAPH_ROLES_FILE`). Without this file (or with an
empty array) dispatch is silently disabled. Seed a minimal roster —
add roles you actually want graph-routed:

```bash
sudo install -d -o root -g root -m 0755 /opt/cortexos/templates/agent-roles
sudo tee /opt/cortexos/templates/agent-roles/.graph-enabled.json <<'EOF'
["eng-backend"]
EOF
sudo chmod 0644 /opt/cortexos/templates/agent-roles/.graph-enabled.json
```

Restart the consumer so the cached roster is reloaded:

```bash
sudo systemctl restart cortex-consumer
```

Publish a sandbox-eligible role event and verify dispatch in
`journalctl`. The real log strings emitted by `consumer.js` are
`[graph] dispatched run=...` on success and
`[graph] dispatch failed ...` on error — match those exactly:

```bash
journalctl -u cortex-consumer -n 200 --no-pager | grep -E '\[graph\] (dispatched|dispatch failed)'
```

## CHECKPOINT 2

**STOP — operator question:** `/healthz` returns 200, a smoke run returns?

Operator: confirm `/healthz` returns 200, a smoke run returns
`status=interrupted`, the roster file at
`/opt/cortexos/templates/agent-roles/.graph-enabled.json` contains
the role(s) you want routed, and `cortex-consumer` logs show
`[graph] dispatched` for at least one role.

Type `confirmed` to proceed.
## Rollback

```bash
cd /opt/cortexos/stacks/cortex-graph
docker compose down

# Optional — destroys all checkpointed run state:
docker exec -i cortex-postgresql psql -U dashboard -d cortex_dashboard \
  < /opt/cortexos/dashboard/migrations/007_langgraph_checkpoints.rollback.sql
```

## Next

→ `prompts/tools/46-openclaw-codex-watchdog.md` (existing chain unchanged).
