# Hermes (latest)

## Purpose

Install Hermes as the only CortexOS agent runtime. Hermes replaces the retired
agent workflow stack and graph dispatch.

## Prerequisites

- `31-9router.md` completed.
- `32-honcho.md` completed.
- No custom agent communication pipeline is required; Paperclip invokes Hermes.

## Install

Use the upstream installer requested by the operator:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
hermes --version
hermes setup
```

Probe the installed CLI before applying profile config. The Paperclip adapter
uses Hermes single-query mode (`hermes chat -q`), so that command must work:

```bash
hermes --help
hermes chat --help
```

Create the CortexOS Hermes registry root:

```bash
sudo install -d -m 0755 /opt/cortexos/hermes/profiles
sudo chown -R "$USER:$USER" /opt/cortexos/hermes
```

## Hermes Web UI service

Run Hermes Dashboard as a loopback-only systemd service. Tailscale Serve exposes
the port; do not bind Hermes Dashboard to a non-loopback address because it can
manage API keys and sessions.

```bash
sudo install -m 0644 templates/systemd/hermes-dashboard.service /tmp/hermes-dashboard.service.template
sudo sed \
  -e "s|{VPS_USER}|${USER}|g" \
  -e "s|{CORTEX_HERMES_ROOT}|/opt/cortexos/hermes|g" \
  /tmp/hermes-dashboard.service.template | sudo tee /etc/systemd/system/hermes-dashboard.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now hermes-dashboard hermes-dashboard-proxy
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:9120/
```

Expected: local proxy probe returns `200` or `302`. Hermes Dashboard itself remains bound to `localhost:9119`; `hermes-dashboard-proxy` listens on `localhost:9120` and rewrites the Host header for Tailscale Serve.

## Model gateway rule

All Hermes model calls go through 9Router. Direct provider keys are not written
to Hermes profile env files.

```bash
set -a
source /opt/cortexos/.secrets/9router.env
set +a

curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  "${NINEROUTER_BASE_URL%/}/v1/models" | jq -e '.data | length > 0'
```

The installed Hermes release checked on 2026-05-20 is advertised as `0.14.0`
by the upstream site. The official Paperclip adapter is installed from npm as
`hermes-paperclip-adapter` and runs Hermes through `hermes chat -q`.

## Next

→ `prompts/tools/41-hermes-profiles.md`
