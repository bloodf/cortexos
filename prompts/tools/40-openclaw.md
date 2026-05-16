# OpenClaw (latest)

## Purpose
Install the latest OpenClaw agent orchestrator from upstream HEAD; configure the `cortex` account with single-role policy; write `~/.openclaw/openclaw.json`.

## Prerequisites
- `31-9router.md` completed (OpenClaw routes all AI calls through 9Router).
- `32-openviking.md` completed (OpenClaw uses OpenViking for memory).
- Node.js ≥ 20 installed.

## CHECKPOINT 1
Operator: confirm Node.js ≥ 20 is installed (`node --version`) and 9Router is running. Type "confirmed" to proceed.

## Install

```bash
npm install -g openclaw@latest
```

Verify:
```bash
openclaw --version
```

## Configure

Write OpenClaw base config `~/.openclaw/openclaw.json`:

```bash
mkdir -p ~/.openclaw
tee ~/.openclaw/openclaw.json <<'EOF'
{
  "account": "cortex",
  "gatewayUrl": "http://127.0.0.1:18789",
  "aiProvider": {
    "baseUrl": "http://127.0.0.1:11434/v1",
    "apiKey": "{9ROUTER_API_KEY}"
  },
  "memory": {
    "backend": "openviking",
    "url": "http://127.0.0.1:18790"
  },
  "channels": []
}
EOF
chmod 600 ~/.openclaw/openclaw.json
```

Apply the cortex role policy:

```bash
cp templates/openclaw/roles/cortex.json ~/.openclaw/roles/cortex.json
```

Install gateway systemd unit from `templates/systemd/openclaw-gateway.service`. Substitute `{VPS_USER}`, `{VPS_HOME}`, `{NODE_BIN}`, `{NODE_BIN_DIR}`, `{NPM_PREFIX}` (Linuxbrew defaults: `{NODE_BIN}=/home/linuxbrew/.linuxbrew/opt/node@24/bin/node`, `{NPM_PREFIX}=/home/linuxbrew/.linuxbrew`).

Template uses `After=network-online.target docker.service caddy.service` + `Wants=network-online.target docker.service` so the gateway waits for routable network AND docker readiness before launch — required for clean post-reboot auto-start (channel plugins fail fast if docker-backed services aren't ready).

```bash
sudo install -m 644 templates/systemd/openclaw-gateway.service /etc/systemd/system/openclaw-gateway.service
# sed -i the placeholders, then:
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway
```

Verify auto-boot wiring:

```bash
systemctl is-enabled openclaw-gateway   # → enabled
systemctl show openclaw-gateway -p After,Wants   # contains network-online.target
```

## Verify

```bash
curl -s http://127.0.0.1:18789/health
```

Expected: gateway health OK (used by `00-preflight.md` probe script).

## CHECKPOINT 2
Operator: confirm OpenClaw gateway is healthy. Type "confirmed" to proceed.

## Known Limitations

### Missing HTTP routes in OpenClaw 2026.5.12 (Phase H blocker #1)

The upstream OpenClaw `2026.5.12` gateway does **not** expose
`/sendMessage` or `/registerRoute`. Any consumer (notably
`stacks/cortex-consumer/consumer.js`) that posts to those endpoints
will receive HTTP 404. See `docs/MESSAGING.md` → "Known Limitations"
for the operator-decision matrix (adapter sidecar vs. RPC migration
vs. dashboard re-route patch). All four channels remain INERT-BY-DESIGN
until this is resolved.

### Plugin discovery silent-skip (Phase H blocker #2)

Plugin manifests dropped into `~/.openclaw/extensions/<name>/` (with
`openclaw.activation` + `openclaw.contributes` already present) do NOT
appear in `openclaw plugins list` after a gateway reload. The gateway
emits no diagnostic. Confirmed via the
`a2a-gateway`, `compaction-context`, `openclaw-codex-watchdog` triple
on 2026-05-16. Working theory: discovery requires an explicit
`openclaw plugins install <path>` invocation that needs an
operator-only gateway auth token. See each plugin spoke
(`44-`, `45-`, `46-`) for the install-from-path step.

## Next
→ `prompts/tools/41-openclaw-channels.md`
