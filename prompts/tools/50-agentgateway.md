# AgentGateway (native)

## Purpose

Deploy the vendored `stacks/cortex-agentgateway/` Node.js service natively under systemd. AgentGateway enforces the tool taxonomy, per-role allow-lists, confirmation tokens, rate limits, and cooldowns defined in `templates/agentgateway/tools.json`.

## Prerequisites

- `40-openclaw.md` completed.
- `30-nats.md` completed.
- `14-postgresql.md` completed.

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

- [ ] CHECKPOINT 1 confirmed — local implementation and tools taxonomy exist
- [ ] Copy `stacks/cortex-agentgateway/`, workspace packages, schemas, and templates to `/opt/cortexos`
- [ ] Install production dependencies with pnpm
- [ ] Write `/opt/cortexos/.secrets/agentgateway.env`
- [ ] Install `stacks/cortex-agentgateway/cortex-agentgateway.service`
- [ ] Confirm `/health` returns ok, missing bearer returns 401, safe tool returns 200
- [ ] Confirm audit subject `cortex.audit.agentgateway.tool-invoke.v1` receives event
- [ ] Write AgentGateway required-role roster
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `test -s stacks/cortex-agentgateway/index.js && jq -e '.tools | length > 0' templates/agentgateway/tools.json` exit 0?

Type `confirmed` to proceed.

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks /opt/cortexos/packages /opt/cortexos/schemas /opt/cortexos/templates/agentgateway
sudo cp -a stacks/cortex-agentgateway/. /opt/cortexos/stacks/cortex-agentgateway/
sudo cp -a packages/cortex-events packages/cortex-audit packages/cortex-telemetry /opt/cortexos/packages/
sudo cp -a schemas/. /opt/cortexos/schemas/
sudo cp -a templates/agentgateway/. /opt/cortexos/templates/agentgateway/
cd /opt/cortexos/stacks/cortex-agentgateway
pnpm install --prod
```

## Configure

```bash
sudo tee /opt/cortexos/.secrets/agentgateway.env <<EOF
AGENTGATEWAY_PORT=18800
AGENTGATEWAY_BEARER_TOKEN=${AGENTGATEWAY_BEARER_TOKEN}
NATS_URL=nats://127.0.0.1:4222
CORTEX_NATS_HMAC=${CORTEX_NATS_HMAC}
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=cortex_dashboard
DB_USER=dashboard
DB_PASSWORD=${DASHBOARD_DB_PASSWORD}
CORTEX_AUDIT_ENABLED=1
EOF
sudo chmod 600 /opt/cortexos/.secrets/agentgateway.env

sudo install -m 0644 /opt/cortexos/stacks/cortex-agentgateway/cortex-agentgateway.service /etc/systemd/system/cortex-agentgateway.service
sudo sed -i "s|User=cortexos|User=$USER|g; s|Group=cortexos|Group=$USER|g" /etc/systemd/system/cortex-agentgateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-agentgateway
```

## Verify

```bash
curl -fsS http://127.0.0.1:18800/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:18800/tool/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"propose_role","runId":"r1","agentId":"a1","role":"factory_agent"}'
curl -fsS -X POST http://127.0.0.1:18800/tool/invoke \
  -H "Authorization: Bearer ${AGENTGATEWAY_BEARER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tool":"propose_role","args":{"description":"summarizer"},"runId":"r1","agentId":"a1","role":"factory_agent"}'
```

Expected: health OK, then `401`, then HTTP 200.

Audit subject pinned to `cortex.audit.agentgateway.tool-invoke.v1`; watch while invoking the safe tool:

```bash
nats sub --count=1 'cortex.audit.agentgateway.tool-invoke.v1'
```

## Roster

```bash
sudo install -d -m 0755 /opt/cortexos/templates/agent-roles
sudo tee /opt/cortexos/templates/agent-roles/.agentgateway-required.json <<'EOF'
["ENG-BACKEND"]
EOF
sudo chmod 0644 /opt/cortexos/templates/agent-roles/.agentgateway-required.json
```

## CHECKPOINT 2

**STOP — operator question:** Did health return OK, unauthenticated invoke return 401, authenticated safe-tool invoke return 200, and NATS receive `cortex.audit.agentgateway.tool-invoke.v1`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/55-langfuse.md`
