# AgentGateway (latest)

## Purpose

Deploy AgentGateway to enforce the tool taxonomy, per-role allow-lists, confirmation tokens, rate limits, and cooldowns defined in `templates/agentgateway/tools.json`. All destructive-class tool calls from AI agents must pass through AgentGateway.

## Prerequisites

- `40-openclaw.md` completed.
- `30-nats.md` completed (AgentGateway publishes audit events to NATS).
- `14-postgresql.md` completed (audit log columns stored in PostgreSQL).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure
- [ ] Build and start
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed
- [ ] Roster (which roles route tool calls through AgentGateway)

## CHECKPOINT 1

**STOP — operator question:** `templates/agentgateway/tools.json` exists and contains the tool taxonomy?

Type `confirmed` to proceed.

## Install

AgentGateway is vendored in this repo under `stacks/cortex-agentgateway/`.
Copy it to the host install root and build the container — no external clone.

```bash
sudo mkdir -p /opt/cortexos/stacks
sudo rsync -a --delete stacks/cortex-agentgateway/ /opt/cortexos/stacks/cortex-agentgateway/
# Workspace packages and schemas are needed by the Docker build context.
sudo rsync -a --delete packages/cortex-events/ /opt/cortexos/packages/cortex-events/
sudo rsync -a --delete packages/cortex-audit/  /opt/cortexos/packages/cortex-audit/
sudo rsync -a --delete packages/cortex-telemetry/ /opt/cortexos/packages/cortex-telemetry/
sudo rsync -a --delete schemas/ /opt/cortexos/schemas/
sudo cp package.json package-lock.json /opt/cortexos/
```

## Configure

Write `/opt/cortexos/.secrets/agentgateway.env`:

```bash
sudo tee /opt/cortexos/.secrets/agentgateway.env <<EOF
AGENTGATEWAY_PORT=18800
AGENTGATEWAY_BEARER_TOKEN={AGENTGATEWAY_BEARER_TOKEN}
NATS_URL=nats://127.0.0.1:4222
CORTEX_NATS_HMAC={CORTEX_NATS_HMAC}
DATABASE_URL=postgresql://dashboard:{DASHBOARD_DB_PASSWORD}@127.0.0.1:5432/cortex_dashboard
CORTEX_AUDIT_ENABLED=1
EOF
sudo chmod 600 /opt/cortexos/.secrets/agentgateway.env
```

The tool taxonomy ships inside the image at
`/app/stacks/cortex-agentgateway/config/tools.json` (a verbatim copy of
`templates/agentgateway/tools.json`). No host-side copy is needed.

## Build and start

```bash
docker network create cortex-net 2>/dev/null || true
cd /opt/cortexos/stacks/cortex-agentgateway
docker compose up -d --build
```

## Verify

Health (no auth):

```bash
curl -fsS http://127.0.0.1:18800/health
```

Expected: `{"status":"ok","service":"cortex-agentgateway",...}`.

Missing bearer → 401:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:18800/tool/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"propose_role","runId":"r1","agentId":"a1","role":"factory_agent"}'
# expect: 401
```

Bearer + safe tool → 200:

```bash
curl -fsS -X POST http://127.0.0.1:18800/tool/invoke \
  -H "Authorization: Bearer ${AGENTGATEWAY_BEARER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tool":"propose_role","args":{"description":"summarizer"},"runId":"r1","agentId":"a1","role":"factory_agent"}'
```

Audit subject pinned to `cortex.audit.agentgateway.tool-invoke.v1`. Watch in
another terminal while invoking the tool above:

```bash
nats sub --count=1 'cortex.audit.agentgateway.>'
```

## CHECKPOINT 2

**STOP — operator question:** `/health` returns 200, missing-bearer returns 401, safe-tool?

Operator: confirm `/health` returns 200, missing-bearer returns 401, safe-tool
invoke returns 200, and the audit event appears on
`cortex.audit.agentgateway.tool-invoke.v1`.

Type `confirmed` to proceed.

## Roster (which roles route tool calls through AgentGateway)

`stacks/cortex-consumer/consumer.js` reads a roster file to decide which
roles must POST `tool_invocation` blocks through `/tool/invoke` instead of
executing tools inline. Default roster matches the sandbox roster
(`["ENG-BACKEND"]`) so destructive backend tool calls are permission-gated
and audited centrally. Operators opt additional roles in by appending here.

```bash
sudo install -d -m 0755 /opt/cortexos/templates/agent-roles
sudo tee /opt/cortexos/templates/agent-roles/.agentgateway-required.json <<'EOF'
[
  "ENG-BACKEND"
]
EOF
```

If `cortex-consumer` is already running, reload roster caches without
restarting the process:

```bash
sudo systemctl kill -s HUP cortex-consumer 2>/dev/null \
  || sudo pkill -HUP -f 'cortex-consumer/consumer.js'
journalctl -u cortex-consumer --since '30s ago' | grep -F '[sighup] roster caches cleared'
```

Otherwise the next consumer start picks the roster up automatically.

## Next

→ `prompts/tools/55-langfuse.md`
