# 9Router (latest)

## Purpose
Install 9Router, the OpenAI-compatible model gateway that proxies AI provider APIs and writes credentials to `/opt/cortexos/.secrets/9router.env`.

## Prerequisites
- `30-nats.md` completed (9Router publishes metrics to NATS).
- AI provider API keys available (at least one: OpenAI, Anthropic, or other).

## CHECKPOINT 1
Operator: confirm you have at least one AI provider API key ready. Type "confirmed" to proceed.

## Install

Clone and install the latest 9Router release:

```bash
git clone https://github.com/9router/9router /opt/cortexos/stacks/9router
cd /opt/cortexos/stacks/9router
npm install
```

Snapshot upstream install docs:
```bash
# Already done by 00-preflight.md — see docs/external/9router-models.snapshot.md
```

## Configure

Write `/opt/cortexos/.secrets/9router.env`:

```bash
sudo tee /opt/cortexos/.secrets/9router.env <<EOF
NINE_ROUTER_PORT=11434
NINE_ROUTER_API_KEY={9ROUTER_API_KEY}
OPENAI_API_KEY={OPENAI_API_KEY}
ANTHROPIC_API_KEY={ANTHROPIC_API_KEY}
NATS_URL=nats://127.0.0.1:4222
EOF
sudo chmod 600 /opt/cortexos/.secrets/9router.env
```

Replace each `{placeholder}` with the actual value. Add or remove provider keys as needed.

Write systemd unit:

```bash
sudo tee /etc/systemd/system/9router.service <<'EOF'
[Unit]
Description=9Router AI model gateway
After=network.target nats.service

[Service]
Type=simple
WorkingDirectory=/opt/cortexos/stacks/9router
EnvironmentFile=/opt/cortexos/.secrets/9router.env
# Headless flags are MANDATORY. Without `--skip-update --no-browser`
# 9Router renders its interactive update prompt or its browser-open
# menu, then exits with status 0 the moment it detects there is no
# TTY — the systemd unit appears "active (exited)" with no logs.
ExecStart=/usr/bin/node index.js --skip-update --no-browser
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable 9router
sudo systemctl start 9router
```

## Verify

```bash
curl -s http://localhost:11434/v1/models | jq '.data[].id' | head -5
```

Expected: model IDs listed (e.g. `gpt-4o`, `claude-sonnet-4-5`).

## CHECKPOINT 2
Operator: confirm `curl localhost:11434/v1/models` returns a model list. Record the endpoint and API key in your notes — every subsequent spoke that calls AI uses this gateway. Type "confirmed" to proceed.

## Next
→ `prompts/tools/32-openviking.md`
