# 34 - Local AI harness through a CortexOS VPS

## Purpose

Use a CortexOS VPS as the AI backend for a local workstation. This keeps the
VPS as the single source of truth for provider credentials, 9Router model
routing, Headroom context compression, and the OMC anthropic-proxy, while the
local machine only needs SSH access over Tailscale.

What gets wired up:

- Persistent SSH tunnels from `localhost` to the VPS for:
  - Headroom (`127.0.0.1:8787`)
  - 9Router (`127.0.0.1:11434`)
  - VPS anthropic-proxy (`127.0.0.1:18082`)
- A `~/.claude/bin/claude` wrapper that:
  - routes normal Claude Code through **VPS Headroom**
  - routes OMC team workers through the **VPS anthropic-proxy** → 9Router
- Shell environment so OpenAI-compatible tools (Hermes, pi, etc.) hit the VPS 9Router.
- A default user-level OMC routing config (`~/.config/claude-omc/config.jsonc`) that targets the VPS 9Router models.

## Prerequisites

- Both the local machine and the CortexOS VPS are joined to the same Tailscale tailnet.
- The VPS has completed at least:
  - `prompts/tools/13-caddy.md` (Tailscale connectivity)
  - `prompts/tools/30e-headroom.md` (Headroom running on `127.0.0.1:8787`)
  - `prompts/tools/31-9router.md` (9Router running on `127.0.0.1:11434`)
  - the VPS anthropic-proxy service is enabled on `127.0.0.1:18082`
- Local machine has:
  - `ssh`, `curl`, `systemctl --user`
  - Claude Code installed (`~/.local/bin/claude`)
  - key-based SSH auth to the VPS user that owns `/opt/cortexos/.secrets/9router.env`

## Ask user

```bash
read -rp "CortexOS VPS Tailscale FQDN or IP: " VPS_HOST
read -rp "VPS SSH user [cortexos]: " VPS_USER
VPS_USER="${VPS_USER:-cortexos}"
read -rp "Path to SSH private key (optional): " VPS_SSH_KEY
```

## Todo

- [ ] CHECKPOINT 1 confirmed — VPS reachable over SSH and remote Headroom/9Router/proxy endpoints respond
- [ ] Run `scripts/install-local-ai-harness.sh` with the answers above
- [ ] CHECKPOINT 2 confirmed — local tunnels are active and all three local endpoints respond

## CHECKPOINT 1

**STOP — operator question:** Is the VPS reachable over SSH and are Headroom, 9Router, and the anthropic-proxy healthy on the VPS?

```bash
ssh "${VPS_USER}@${VPS_HOST}" echo ok
curl -fsS "http://${VPS_HOST}:8787/health" 2>/dev/null || echo "Headroom not exposed on tailnet (expected; will tunnel)"
ssh "${VPS_USER}@${VPS_HOST}" 'curl -fsS http://127.0.0.1:8787/health >/dev/null && echo headroom-ok'
ssh "${VPS_USER}@${VPS_HOST}" 'curl -fsS http://127.0.0.1:11434/v1/models >/dev/null && echo 9router-ok'
ssh "${VPS_USER}@${VPS_HOST}" 'curl -fsS http://127.0.0.1:18082/v1/models >/dev/null && echo proxy-ok'
```

Type `confirmed` to proceed.

## Install

Run the installer from the repo root:

```bash
cd /opt/cortexos
export VPS_HOST="${VPS_HOST:?}"
export VPS_USER="${VPS_USER:-cortexos}"
[[ -n "${VPS_SSH_KEY:-}" ]] && export VPS_SSH_KEY
bash scripts/install-local-ai-harness.sh
```

The script will:

1. Fetch `NINEROUTER_API_KEY` from `/opt/cortexos/.secrets/9router.env` on the VPS.
2. Create a user systemd service `cortexos-vps-tunnel.service` that forwards local ports `8787`, `11434`, and `18082` to the VPS.
3. Install the OMC-aware Claude wrapper into `~/.claude/bin/claude`.
4. Append a marked block to `~/.bashrc` and `~/.zshrc` with:
   - `OPENAI_API_KEY` / `OPENAI_BASE_URL` for 9Router
   - `OMC_ROUTING_FORCE_INHERIT=false`
   - a `claude()` shell function that always uses the wrapper
5. Write `~/.config/claude-omc/config.jsonc` with the default 9Router tier routing.
6. Enable and start the tunnel service.

> **Tip:** Install `autossh` on the local machine before running the script if you want the tunnel service to automatically reconnect. The script falls back to plain `ssh` otherwise.

## Verify

After the script finishes, open a **new shell** (or `source ~/.bashrc`) and run:

```bash
systemctl --user status cortexos-vps-tunnel.service
curl -fsS http://127.0.0.1:8787/health | python3 -m json.tool
curl -fsS -H "Authorization: Bearer ${OPENAI_API_KEY}" http://127.0.0.1:11434/v1/models | head -c 400
curl -fsS -X POST http://127.0.0.1:18082/v1/messages \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dummy' \
  -H 'anthropic-version: 2023-06-01' \
  -d '{"model":"cx/gpt-5.5","max_tokens":20,"messages":[{"role":"user","content":"hello"}]}' \
  | python3 -m json.tool
```

Expected:

- `cortexos-vps-tunnel.service` is `active (running)`.
- `/health` returns `{"status":"healthy","ready":true,...}`.
- `/v1/models` returns a list including `cx/gpt-5.5`, `minimax/MiniMax-M3`, and `kimi/kimi-k2.6`.
- `/v1/messages` returns a Claude-format response with assistant content.

## CHECKPOINT 2

**STOP — operator question:** Did the tunnel service come up and did all three local endpoint checks succeed?

Type `confirmed` to proceed.

## Command reference

| Command | What it does |
| --- | --- |
| `claude` | Launches Claude Code through the wrapper → VPS Headroom |
| `OMC_TEAM_WORKER=team/foo claude ...` | Launches an OMC worker → VPS anthropic-proxy → 9Router |
| `systemctl --user {start,stop,status} cortexos-vps-tunnel.service` | Manage the SSH tunnels |
| `omc config` | Inspect the resolved user-level OMC routing |

## Environment variables set locally

```bash
OPENAI_API_KEY=<VPS 9Router key>
OPENAI_BASE_URL=http://127.0.0.1:11434/v1
OMC_ROUTING_FORCE_INHERIT=false
```

## Next

- Use Claude Code normally: `claude`
- Use OMC inside a project: ensure the project has a `.claude/omc.jsonc` (or rely on the user-level default), then run `/team` commands inside Claude Code.
- For OpenAI-compatible agents, point them at `http://127.0.0.1:11434/v1` with `${OPENAI_API_KEY}`.
- **Pick which 9Router model to use per task** — see
  `prompts/tools/35a-local-harness-9router.md` for the canonical model set,
  cost, and per-harness wiring.
