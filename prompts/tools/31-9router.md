# 9Router (latest)

## Purpose

Install 9Router, the OpenAI-compatible model gateway that proxies AI provider APIs and writes credentials to `/opt/cortexos/.secrets/9router.env`.

## Prerequisites

- `30-nats.md` completed (9Router publishes metrics to NATS).
- `13-tailscale-serve.md` completed (operator reaches the 9Router WebUI through Tailscale Serve on port `11434`).
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
- [ ] Install or upgrade 9Router from npm with `npm install -g 9router@latest`
- [ ] Generate `NINEROUTER_API_KEY` via `openssl rand -hex 32`
- [ ] Write `/opt/cortexos/.secrets/9router.env` (mode 0600, no provider keys inside)
- [ ] Install systemd unit and `systemctl enable --now 9router`
- [ ] Open WebUI at `https://${CORTEX_DOMAIN}:11434/dashboard`, sign in with master token
- [ ] Add each provider key (OpenAI / Anthropic / …) in WebUI's API Keys view
- [ ] CHECKPOINT 2 confirmed — `/v1/models` returns non-empty `data` (HTTP 200)

## CHECKPOINT 1

**STOP — operator question:** You have at least one AI provider API key in hand AND you understand that you will paste it into the 9Router WebUI (not into any prompt or env file)?

Type `confirmed` to proceed.

## Install

Install the latest 9Router npm package globally:

```bash
npm install -g 9router@latest
9router --version

NODE_BIN="$(command -v node)"
NODE_BIN_DIR="$(dirname "$NODE_BIN")"
NPM_PREFIX="$(npm prefix -g)"
test -x "${NPM_PREFIX}/bin/9router"
```

Snapshot upstream install docs:

```bash
# Optional: capture upstream install docs outside git if needed.
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

Install systemd unit from `templates/systemd/9router.service`. Substitute placeholders (`{VPS_USER}`, `{VPS_HOME}`, `{NODE_BIN}`, `{NODE_BIN_DIR}`, `{NPM_PREFIX}`) using the values captured during `Install` — typical Linuxbrew layout: `{NODE_BIN}=/home/linuxbrew/.linuxbrew/opt/node@24/bin/node`, `{NPM_PREFIX}=/home/linuxbrew/.linuxbrew`.

The template uses `After=network-online.target` + `Wants=network-online.target` so the unit waits for routable network before launch — critical for post-reboot auto-start. It also passes `--host 127.0.0.1 --port 11434` explicitly because upstream npm 9Router defaults to `0.0.0.0:20128`, while CortexOS exposes the service through Tailscale Serve on the same port. Headless flags `--skip-update --no-browser` are MANDATORY — without them 9Router renders interactive update prompt or browser-open menu, then exits with status 0 the moment it detects no TTY (unit appears `active (exited)` with no logs).

```bash
sudo install -m 644 templates/systemd/9router.service /etc/systemd/system/9router.service
sudo sed -i \
  -e "s|{VPS_USER}|cortexos|g" \
  -e "s|{VPS_HOME}|/home/cortexos|g" \
  -e "s|{NODE_BIN}|${NODE_BIN}|g" \
  -e "s|{NODE_BIN_DIR}|${NODE_BIN_DIR}|g" \
  -e "s|{NPM_PREFIX}|${NPM_PREFIX}|g" \
  /etc/systemd/system/9router.service
sudo systemctl daemon-reload
sudo systemctl enable --now 9router
```

`enable --now` enables auto-start at boot AND starts the unit immediately. Verify auto-boot wiring:

```bash
systemctl is-enabled 9router   # → enabled
systemctl show 9router -p WantedBy   # → multi-user.target
```

### Existing clone migration

If this machine already has the older git-clone install under `/opt/cortexos/stacks/9router`, migrate it in place:

```bash
sudo systemctl stop 9router 2>/dev/null || true
npm install -g 9router@latest
9router --version

NODE_BIN="$(command -v node)"
NODE_BIN_DIR="$(dirname "$NODE_BIN")"
NPM_PREFIX="$(npm prefix -g)"
test -x "${NPM_PREFIX}/bin/9router"

sudo install -m 644 templates/systemd/9router.service /etc/systemd/system/9router.service
sudo sed -i \
  -e "s|{VPS_USER}|cortexos|g" \
  -e "s|{VPS_HOME}|/home/cortexos|g" \
  -e "s|{NODE_BIN}|${NODE_BIN}|g" \
  -e "s|{NODE_BIN_DIR}|${NODE_BIN_DIR}|g" \
  -e "s|{NPM_PREFIX}|${NPM_PREFIX}|g" \
  /etc/systemd/system/9router.service
sudo systemctl daemon-reload
sudo systemctl enable --now 9router
systemctl is-enabled 9router
set -a
source /opt/cortexos/.secrets/9router.env
set +a
curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" http://127.0.0.1:11434/v1/models | jq '.data | length'
```

After the npm-backed service is healthy, the old clone is no longer used and may be removed:

```bash
sudo rm -rf /opt/cortexos/stacks/9router
```

## Configure providers in 9Router WebUI

Provider API keys (OpenAI, Anthropic, Mistral, Groq, etc.) are entered in the 9Router WebUI — never pasted into prompts, shell history, or `.env` files.

Print the URL the operator should open:

```bash
: "${CORTEX_DOMAIN:?CORTEX_DOMAIN unset — re-run prompts/00-bootstrap.md so the Tailscale FQDN is exported}"
echo
echo "Open 9Router WebUI:    https://${CORTEX_DOMAIN}:11434/dashboard"
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
