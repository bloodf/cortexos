# OpenClaw (latest)

## Purpose

Install the latest OpenClaw agent orchestrator from upstream HEAD; configure the `cortex` account with single-role policy; write `~/.openclaw/openclaw.json`.

## Prerequisites

- `31-9router.md` completed (OpenClaw routes all AI calls through 9Router).
- `32-openviking.md` completed (OpenClaw uses OpenViking for memory).
- Node.js ≥ 20 installed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

> **Node bootstrap.** Ubuntu/Debian install Node via NodeSource or Linuxbrew. Verify `node --version` is ≥ 20 before continuing.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — Node ≥ 20 + 9Router up
- [ ] `npm install -g openclaw@latest`
- [ ] Confirm `openclaw --version` prints a version
- [ ] Write `~/.openclaw/openclaw.json` (account=cortex, gateway 18789, OV 18790, 9Router 11434)
- [ ] `chmod 600 ~/.openclaw/openclaw.json`
- [ ] Copy `templates/openclaw/roles/cortex.json` to `~/.openclaw/roles/cortex.json`
- [ ] Install + enable `openclaw-gateway.service` from `templates/systemd/`
- [ ] Confirm `curl http://127.0.0.1:18789/health` returns OK
- [ ] CHECKPOINT 2 confirmed — gateway `/health` returns OK
- [ ] Review Known Limitations (WebSocket RPC, plugin discovery silent-skip)

## CHECKPOINT 1

**STOP — operator question:** Does `node --version` print `v20.x` or higher (not `v18.x`, not `command not found`)?

Type `confirmed` to proceed.

## CHECKPOINT 1b

**STOP — operator question:** Does `systemctl is-active 9router` print `active` (not `inactive` and not `failed`)?

Type `confirmed` to proceed.

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

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:18789/health` return an OK response (not `connection refused`, not HTTP 502) AND does `systemctl is-active openclaw-gateway` print `active` (not `active (exited)`)?

Type `confirmed` to proceed.

## Known Limitations

### Gateway is WebSocket RPC, not HTTP REST

The OpenClaw `2026.5.12+` gateway exposes only `/health` over HTTP; all
delivery RPC runs over WebSocket. The legacy `/sendMessage` /
`/registerRoute` HTTP routes never existed upstream. CortexOS consumers
deliver via the `openclaw` CLI (`openclaw message send`,
`openclaw agents bind`) — see `stacks/cortex-consumer/consumer.js` and
`docs/MESSAGING.md`. The experimental `v1` HTTP delivery path
(`OPENCLAW_DELIVERY_API_VERSION=v1`) is opt-in and gated on upstream
publishing the REST surface.

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
