# 9Router (latest)

## Purpose

Install 9Router, the OpenAI-compatible model gateway that proxies AI provider APIs and writes credentials to `/opt/cortexos/.secrets/9router.env`.

## Prerequisites

- `30-nats.md` completed (9Router publishes metrics to NATS).
- `13-caddy.md` completed (operator reaches the 9Router WebUI through the Tailscale-served reverse proxy).
- AI provider API keys available (at least one: OpenAI, Anthropic, or other). These are entered in the 9Router WebUI later — NOT pasted into prompts or env files.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

> **Node runtime.** Ubuntu/Debian provisioning uses NodeSource (or Linuxbrew Node 24). All `npm install -g` invocations below assume Node ≥ 20 is on `$PATH`.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — provider API key in hand, will go into WebUI not into a prompt
- [ ] Clone + `npm install` 9Router at `/opt/cortexos/stacks/9router`
- [ ] Generate `NINEROUTER_API_KEY` via `openssl rand -hex 32`
- [ ] Write `/opt/cortexos/.secrets/9router.env` (mode 0600, no provider keys inside)
- [ ] Install systemd unit and `systemctl enable --now 9router`
- [ ] Open WebUI at `https://${CORTEX_DOMAIN}/9router/`, sign in with master token
- [ ] Add each provider key (OpenAI / Anthropic / …) in WebUI's API Keys view
- [ ] CHECKPOINT 2 confirmed — `/v1/models` returns non-empty `data` (HTTP 200)

## CHECKPOINT 1

**STOP — operator question:** You have at least one AI provider API key in hand AND you understand that you will paste it into the 9Router WebUI (not into any prompt or env file)?

Type `confirmed` to proceed.

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

Write `/opt/cortexos/.secrets/9router.env` with the master admin key only — provider API keys (OpenAI, Anthropic, etc.) are NOT written here; they live in the 9Router WebUI's encrypted store:

```bash
NINEROUTER_API_KEY="$(openssl rand -hex 32)"
sudo tee /opt/cortexos/.secrets/9router.env <<EOF
NINEROUTER_BASE_URL=http://127.0.0.1:11434
NINEROUTER_PORT=11434
NINEROUTER_API_KEY=${NINEROUTER_API_KEY}
NINEROUTER_NATS_URL=nats://127.0.0.1:4222
EOF
sudo chmod 600 /opt/cortexos/.secrets/9router.env
```

`NINEROUTER_API_KEY` is the master bearer the rest of CortexOS uses to call `/v1/*` AND the admin token for the WebUI session. Record it somewhere you can paste it back later.

> **Canonical env contract.** All 9Router env vars use the `NINEROUTER_*` prefix (no underscore split). Canonical port is `11434`. Every downstream spoke that calls AI — dashboard, OpenClaw, OpenViking, LEANN, AgentGateway, consumer — receives `NINEROUTER_BASE_URL=http://127.0.0.1:11434` and `NINEROUTER_API_KEY={9ROUTER_API_KEY}` propagated from this spoke's env. Each spoke's own `.secrets/*.env` writes a copy; rotation of the 9Router master key requires re-running the propagation step.

Install systemd unit from `templates/systemd/9router.service`. Substitute placeholders (`{VPS_USER}`, `{VPS_HOME}`, `{NODE_BIN}`, `{NODE_BIN_DIR}`, `{NPM_PREFIX}`) — typical Linuxbrew layout: `{NODE_BIN}=/home/linuxbrew/.linuxbrew/opt/node@24/bin/node`, `{NPM_PREFIX}=/home/linuxbrew/.linuxbrew`.

The template uses `After=network-online.target` + `Wants=network-online.target` so the unit waits for routable network before launch — critical for post-reboot auto-start. Headless flags `--skip-update --no-browser` are MANDATORY — without them 9Router renders interactive update prompt or browser-open menu, then exits with status 0 the moment it detects no TTY (unit appears `active (exited)` with no logs).

```bash
sudo install -m 644 templates/systemd/9router.service /etc/systemd/system/9router.service
# Substitute placeholders in the installed copy with sed -i, then:
sudo systemctl daemon-reload
sudo systemctl enable --now 9router
```

`enable --now` enables auto-start at boot AND starts the unit immediately. Verify auto-boot wiring:

```bash
systemctl is-enabled 9router   # → enabled
systemctl show 9router -p WantedBy   # → multi-user.target
```

## Configure providers in 9Router WebUI

Provider API keys (OpenAI, Anthropic, Mistral, Groq, etc.) are entered in the 9Router WebUI — never pasted into prompts, shell history, or `.env` files.

Print the URL the operator should open:

```bash
: "${CORTEX_DOMAIN:?CORTEX_DOMAIN unset — re-run prompts/00-bootstrap.md so the Tailscale FQDN is exported}"
echo
echo "Open 9Router WebUI:    https://${CORTEX_DOMAIN}/9router/"
echo "Master admin token:    (NINEROUTER_API_KEY from /opt/cortexos/.secrets/9router.env)"
echo
```

Operator steps (in the browser, on the laptop):

1. Open the URL above.
2. Sign in with the master admin token (`NINEROUTER_API_KEY`).
3. Add each provider key in the WebUI's **Providers** / **API Keys** view (OpenAI, Anthropic, Mistral, Groq, …).
4. Save. 9Router persists the keys to its own encrypted store on the VPS; nothing is written back into the prompts.
5. Confirm the **Models** view lists at least one model from a provider you just added — the gateway is live.

Do **not** continue to Verify until the operator has added at least one provider key in the WebUI. Step `Verify` proves the keys took effect.

## Verify

```bash
set -a
source /opt/cortexos/.secrets/9router.env
set +a
curl -fsS -H "Authorization: Bearer $NINEROUTER_API_KEY" \
  "${NINEROUTER_BASE_URL:-http://localhost:11434}/v1/models" \
  | jq '.data[].id' | head -5
```

Expected: model IDs listed (e.g. `gpt-4o`, `claude-sonnet-4-5`). An **empty** `data` array means the operator did not add provider keys in the WebUI yet — go back, add them, re-run. HTTP 401 means master-key wiring is broken — fix before continuing.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -H "Authorization: Bearer $NINEROUTER_API_KEY" $NINEROUTER_BASE_URL/v1/models` return HTTP 200 with a **non-empty** `data` array (not an empty `data: []`, not HTTP 401)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/32-openviking.md`
