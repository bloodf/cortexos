# Local AI harness through a CortexOS VPS

Use a CortexOS VPS as the AI backend for a local workstation. The VPS keeps the
provider credentials, 9Router model routing, Headroom context-compression proxy,
and the OMC anthropic-proxy. The local machine only needs SSH access over
Tailscale and a small set of generated files.

## What gets installed locally

- **SSH tunnels** managed by a user systemd service (`cortexos-vps-tunnel.service`):
  - `127.0.0.1:8787` → VPS Headroom
  - `127.0.0.1:11434` → VPS 9Router
  - `127.0.0.1:18082` → VPS anthropic-proxy
  - `127.0.0.1:18690` → VPS Honcho memory API
- **`~/.claude/bin/claude` wrapper**:
  - Normal Claude Code → `127.0.0.1:8787` (VPS Headroom)
  - OMC team workers (`OMC_TEAM_WORKER` set) → `127.0.0.1:18082` (VPS anthropic-proxy → 9Router)
- **Shell environment** in `~/.bashrc` / `~/.zshrc`:
  - `OPENAI_API_KEY` / `OPENAI_BASE_URL` for OpenAI-compatible agents to use VPS 9Router
  - `OMC_ROUTING_FORCE_INHERIT=false`
  - `claude()` shell function that always uses the wrapper
- **`~/.config/claude-omc/config.jsonc`** with default 9Router tier routing:
  - `HIGH` → `cx/gpt-5.5`
  - `MEDIUM` → `minimax/MiniMax-M3`
  - `LOW` → `kimi/kimi-k2.6`

## Prerequisites

- Both the local machine and the CortexOS VPS are on the same Tailscale tailnet.
- The VPS has Headroom, 9Router, the anthropic-proxy, and Honcho running on their default localhost ports.
- Local machine has `ssh`, `curl`, `systemctl --user`, and Claude Code installed.
- Key-based SSH auth to the VPS user that owns `/opt/cortexos/.secrets/9router.env`.

## Quick start

```bash
cd /opt/cortexos
export VPS_HOST="cortex.tailXXXX.ts.net"   # Tailscale FQDN or IP
export VPS_USER="cortexos"                 # default
# export VPS_SSH_KEY="$HOME/.ssh/id_ed25519"  # optional
bash scripts/install-local-ai-harness.sh
```

The installer also builds and registers the
`packages/cortex-honcho-memory-mcp` MCP server in `~/.claude/mcp.json` so
Claude Code gets directory-scoped Honcho memory.

Then open a new shell and verify:

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
curl -fsS http://127.0.0.1:18690/health | python3 -m json.tool
```

## Using Claude Code

```bash
claude
```

This launches Claude Code through the wrapper, which points it at the VPS
Headroom tunnel. Headroom handles context optimization and forwards to Anthropic.

## Using OMC

Inside a Claude Code session started with `claude`, run OMC `/team` commands as
usual. The wrapper detects `OMC_TEAM_WORKER` on spawned worker panes and routes
them through the VPS anthropic-proxy, so each worker hits the 9Router models
configured in `~/.config/claude-omc/config.jsonc`.

## Using other OpenAI-compatible agents

Any local tool that reads `OPENAI_API_KEY` and `OPENAI_BASE_URL` will use the VPS
9Router:

```bash
export OPENAI_API_KEY="<VPS 9Router key>"
export OPENAI_BASE_URL="http://127.0.0.1:11434/v1"
```

> **Note:** Codex 0.136+ uses OpenAI's Responses API over a hard-coded WebSocket
> and ignores `OPENAI_BASE_URL`, so this routing does not apply to recent Codex
> versions. Use Claude Code through OMC for non-OpenAI models instead.

## Files installed/modified

| Path | Purpose |
| --- | --- |
| `~/.config/systemd/user/cortexos-vps-tunnel.service` | Persistent SSH tunnels |
| `~/.claude/bin/claude` | OMC-aware Claude launcher |
| `~/.bashrc`, `~/.zshrc` | Env vars and `claude()` function (marked block) |
| `~/.config/claude-omc/config.jsonc` | Default OMC routing |
| `~/.claude/mcp.json` | Honcho memory MCP registration |

## Troubleshooting

- **Tunnels fail to start:** Ensure `autossh` or `ssh` is installed. Check `journalctl --user -u cortexos-vps-tunnel.service`.
- **Local endpoint returns connection refused:** The tunnel service may not be running. Run `systemctl --user restart cortexos-vps-tunnel.service`.
- **Claude Code still hits the real Anthropic API:** Make sure a new shell was started so `~/.claude/bin` is first in `PATH`, or run `claude` through the wrapper directly: `~/.claude/bin/claude`.
- **OMC workers use the wrong model:** Verify `OMC_ROUTING_FORCE_INHERIT=false` is set and run `omc config` to inspect resolved routing.
- **Honcho memory tools do not appear in Claude Code:** Confirm the MCP server is built (`pnpm --filter @cortexos/honcho-memory-mcp build`), the tunnel is forwarding `127.0.0.1:18690`, and `~/.claude/mcp.json` contains an `honcho-memory` entry. Restart Claude Code after editing `mcp.json`.
