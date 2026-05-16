# AgentGateway (latest)

## Purpose
Deploy AgentGateway to enforce the tool taxonomy, per-role allow-lists, confirmation tokens, rate limits, and cooldowns defined in `templates/agentgateway/tools.json`. All destructive-class tool calls from AI agents must pass through AgentGateway.

## Prerequisites
- `40-openclaw.md` completed.
- `30-nats.md` completed (AgentGateway publishes audit events to NATS).
- `14-postgresql.md` completed (audit log columns stored in PostgreSQL).

## CHECKPOINT 1
Operator: confirm `templates/agentgateway/tools.json` exists and contains the tool taxonomy. Type "confirmed" to proceed.

## Install

```bash
git clone https://github.com/agentgateway/agentgateway /opt/cortexos/stacks/agentgateway
cd /opt/cortexos/stacks/agentgateway
npm install
```

## Configure

Copy tool taxonomy:

```bash
mkdir -p /opt/cortexos/stacks/agentgateway/config
cp templates/agentgateway/tools.json /opt/cortexos/stacks/agentgateway/config/tools.json
```

Write `/opt/cortexos/.secrets/agentgateway.env`:

```bash
sudo tee /opt/cortexos/.secrets/agentgateway.env <<EOF
AGENTGATEWAY_PORT=18800
NATS_URL=nats://127.0.0.1:4222
DATABASE_URL=postgresql://dashboard:{DASHBOARD_DB_PASSWORD}@127.0.0.1:5432/cortex_dashboard
CONFIRMATION_TOKEN_SECRET={AGENTGATEWAY_TOKEN_SECRET}
EOF
sudo chmod 600 /opt/cortexos/.secrets/agentgateway.env
```

Write systemd unit:

```bash
sudo tee /etc/systemd/system/agentgateway.service <<'EOF'
[Unit]
Description=AgentGateway tool enforcement
After=network.target nats.service postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/cortexos/stacks/agentgateway
EnvironmentFile=/opt/cortexos/.secrets/agentgateway.env
ExecStart=/usr/bin/node index.js --config config/tools.json
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable agentgateway
sudo systemctl start agentgateway
```

## Verify

```bash
curl -s http://localhost:18800/health
```

Expected: health OK response.

```bash
# Test that a deny-listed tool is rejected
curl -s -X POST http://localhost:18800/tool/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool": "shell_rm_rf", "role": "cortex"}'
```

Expected: `403 Forbidden` or `{"allowed": false, "reason": "deny-list"}`.

## CHECKPOINT 2
Operator: confirm AgentGateway is healthy, audit events appear in NATS subject `cortex.audit.*`, and the deny-list test returns 403. Type "confirmed" to proceed.

## Next
→ `prompts/tools/60-cortex-consumer.md`
