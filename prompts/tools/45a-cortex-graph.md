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
- `60-cortex-consumer.md` is required only for the consumer wiring + dispatch-log verification block later in this prompt. The sidecar itself can be deployed before the consumer.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — Postgres reachable at 127.0.0.1:5432
- [ ] CHECKPOINT 1b confirmed — NATS reachable at 127.0.0.1:4222
- [ ] CHECKPOINT 1c confirmed — Docker daemon up
- [ ] Replay migration 007 via dashboard `migrate.js`
- [ ] Verify `007_langgraph_checkpoints` row in migrations table
- [ ] Decrypt `templates/.secrets/graph.enc.yaml` to `/opt/cortexos/.secrets/graph.env` (mode 0600)
- [ ] `docker compose up -d --build` in `stacks/cortex-graph`
- [ ] Confirm `curl http://127.0.0.1:8090/healthz` returns `{"status":"ok"}`
- [ ] Confirm bearer-protected probe run returns `status=interrupted`
- [ ] Export `CORTEX_GRAPH_URL` + `CORTEX_GRAPH_API_TOKEN` to cortex-consumer, restart
- [ ] Write `/opt/cortexos/templates/agent-roles/.graph-enabled.json` roster
- [ ] Verify `[graph] dispatched` appears in consumer journal
- [ ] CHECKPOINT 2 confirmed — /healthz returns 200
- [ ] CHECKPOINT 2b confirmed — probe run returns status=interrupted
- [ ] CHECKPOINT 2c confirmed — roster file contains routed role(s)
- [ ] CHECKPOINT 2d confirmed — consumer journal shows `[graph] dispatched`

## CHECKPOINT 1

**STOP — operator question:** Does `pg_isready -h 127.0.0.1 -p 5432` print `accepting connections` (not `no response`, not `command not found`)?

Type `confirmed` to proceed.

## CHECKPOINT 1b

**STOP — operator question:** Does `nc -zv 127.0.0.1 4222` print `succeeded` (not `Connection refused`)?

Type `confirmed` to proceed.

## CHECKPOINT 1c

**STOP — operator question:** Does `docker info >/dev/null 2>&1 && echo ok` print `ok` (not `Cannot connect to the Docker daemon`)?

Type `confirmed` to proceed.

## Apply migration 007

Migrations are dashboard-driven; the dashboard entrypoint replays
`migrations/*.sql` in lexical order on boot. Force-replay on the VPS:

```bash
if docker ps --format "{{.Names}}" | grep -qx cortex-dashboard; then
  docker compose -f /opt/cortexos/stacks/cortex-dashboard/docker-compose.yml \
    exec -T cortex-dashboard node scripts/migrate.js
else
  psql -v ON_ERROR_STOP=1 -U dashboard -h 127.0.0.1 cortex_dashboard \
    < packages/cortex-dashboard/migrations/007_langgraph_checkpoints.sql
fi
```

Verify:

```bash
docker exec -it cortex-postgresql psql -U dashboard -d cortex_dashboard \
  -c "select name from migrations where name = '007_langgraph_checkpoints';"
```

Expected: one row.

## Decrypt graph.env

```bash
bash /opt/cortexos/scripts/secrets-decrypt.sh graph
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

If Postgres and NATS are only exposed on the host loopback interface (the
common CortexOS default), the container cannot reach them over `cortex-net`. In
that case either:

1. publish those services onto `cortex-net`, or
2. switch `cortex-graph` to `network_mode: host` and keep `PG_DSN` / `NATS_URL`
   on `127.0.0.1`.

Document whichever path you choose — both are valid, but the stock compose file
assumes network reachability that may not exist on every host.

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

Bearer-protected endpoint probe (token from `graph.env`):

```bash
TOKEN=$(sudo grep '^CORTEX_GRAPH_API_TOKEN=' /opt/cortexos/.secrets/graph.env | cut -d= -f2-)
curl -fsS -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"role":"PM","issueId":"probe-1","input":{"title":"probe"}}' \
  http://127.0.0.1:8090/graph/runs
```

Expected: `200` with body `{"runId":...,"threadId":...,"status":"interrupted","nodeId":"human_review"}`.

## Wire cortex-consumer

Set on the consumer host (compose env or `.secrets/consumer.env`):

```bash
CORTEX_GRAPH_URL=http://127.0.0.1:8090
CORTEX_GRAPH_API_TOKEN=<same as graph.env>
```

If `cortex-consumer` is already installed, restart it. Roles with `graphEnabled: true` will now dispatch via the sidecar; roles without the flag keep the legacy direct path. If `60-cortex-consumer.md` has not run yet, apply the env + roster now and defer the dispatch-log verification until that later spoke.

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

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:8090/healthz` return `{"status":"ok"}` (not `connection refused`, not HTTP 502)?

Type `confirmed` to proceed.

## CHECKPOINT 2b

**STOP — operator question:** Did the bearer-protected probe POST to `/graph/runs` return a body containing `"status":"interrupted"` (not 401, not 500)?

Type `confirmed` to proceed.

## CHECKPOINT 2c

**STOP — operator question:** Does `cat /opt/cortexos/templates/agent-roles/.graph-enabled.json` print a non-empty JSON array containing the role names you want graph-routed (not `[]`, not `No such file`)?

Type `confirmed` to proceed.

## CHECKPOINT 2d

**STOP — operator question:** Does `journalctl -u cortex-consumer -n 200 --no-pager | grep -E '\[graph\] dispatched'` print at least one matching line (not empty, not `dispatch failed`)?

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
