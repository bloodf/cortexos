# headroom (context compression)

## Purpose

Install [Headroom](https://github.com/chopratejas/headroom) on the host and enable it for AI agent traffic. Headroom runs a local optimization proxy (`:8787`) plus MCP tools so Claude Code and Codex can compress tool outputs, logs, files, and long context before model calls. Use it as the default per-user agent compression layer; it does not select the model provider — that remains configured per agent profile.

## Prerequisites

- `00-preflight.md` completed.
- Python 3.10+ available, or `uv` available to install a managed Python runtime.
- `~/.local/bin` on the operator `$PATH`.
- Anthropic/OpenAI credentials already present in the operator environment for the wrapped agents.

## Sudo gate

**Not required.** Install as the operator user. Do not install into system Python.

## Ask user

| Field | Default | Notes |
| --- | --- | --- |
| Enable persistent proxy for every agent action? | `yes` | Installs a user systemd service and configures supported agents. |
| Enable MCP tools? | `yes` | Adds `headroom_compress`, `headroom_retrieve`, and `headroom_stats`. |
| Telemetry | `off` | CortexOS default: local-first, no anonymous telemetry. |

```bash
read -p "Enable persistent Headroom proxy for every agent action? (yes/no) [yes]: " _persist
HEADROOM_PERSISTENT="${_persist:-yes}"
read -p "Enable Headroom MCP tools? (yes/no) [yes]: " _mcp
HEADROOM_MCP="${_mcp:-yes}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed — no existing Headroom install conflicts with the intended install path
- [ ] Install `headroom-ai[proxy,mcp,code]` with `uv tool install --python 3.12`
- [ ] `headroom --version` prints a version
- [ ] If `HEADROOM_PERSISTENT=yes`, install the persistent per-user proxy and provider routing
- [ ] If `HEADROOM_MCP=yes`, register MCP tools for supported agents
- [ ] CHECKPOINT 2 confirmed — proxy is healthy and MCP status reports the proxy running

## CHECKPOINT 1

**STOP — operator question:** Does the host have no conflicting Headroom install, and is `uv` or Python 3.10+ available?

```bash
command -v headroom || true
command -v uv || python3 --version
```

Type `confirmed` to proceed.

## Install

Prefer `uv tool install` so Headroom and its native dependencies stay out of system Python:

```bash
uv tool install --python 3.12 "headroom-ai[proxy,mcp,code]"
```

If `uv` is unavailable but Python 3.10+ has a user-writable pip environment, use:

```bash
python3 -m pip install --user "headroom-ai[proxy,mcp,code]"
```

Verify:

```bash
headroom --version
```

## Enable for every agent action

Install Headroom as a persistent per-user service and configure supported providers (`claude`, `codex` when present) to route through the local proxy. The proxy backend targets an OpenAI-compatible chat endpoint so all wrapped agents use the configured OpenAI-compatible endpoint (not Anthropic directly).

```bash
export OPENAI_API_KEY="${OPENAI_API_KEY}"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-https://api.openai.com/v1}"

headroom install apply \
  --preset persistent-service \
  --runtime python \
  --scope user \
  --providers auto \
  --port 8787 \
  --backend openai \
  --mode token \
  --memory \
  --no-telemetry
```

This creates a user systemd service named `headroom-default.service`, keeps the proxy running at `http://127.0.0.1:8787`, and applies durable agent routing for supported local CLIs. Restart any already-running agent session so it picks up the updated provider config.

> **Why `openai` backend?** an OpenAI-compatible endpoint exposes the same `/v1` endpoint. Headroom's `openai` backend forwards the compressed request to `OPENAI_BASE_URL` using `OPENAI_API_KEY`, so wrapped agents (Claude Code, Codex, etc.) transparently route through that endpoint instead of calling Anthropic or OpenAI directly.

## Enable MCP tools

Register Headroom's local MCP tools after the proxy exists:

```bash
headroom mcp install --proxy-url http://127.0.0.1:8787 --force
```

The MCP tools are complementary to proxy routing:

| Tool | Use |
| --- | --- |
| `headroom_compress` | Compress large content on demand. |
| `headroom_retrieve` | Retrieve original content by hash. |
| `headroom_stats` | Show session and proxy savings. |

## Verify

```bash
headroom install status
headroom mcp status
curl -fsS http://127.0.0.1:8787/health
```

Expected:

- `headroom install status` reports `Status: running` and `Healthy: yes`.
- `headroom mcp status` reports MCP SDK installed and proxy running.
- `/health` returns JSON with `status: healthy`, `ready: true`, and `optimize: true`.

## CHECKPOINT 2

**STOP — operator question:** Did the persistent service report healthy, and did MCP status report the proxy running?

Type `confirmed` to proceed.

## Command reference

| Command | Action |
| --- | --- |
| `headroom install status` | Show persistent deployment status. |
| `headroom install restart` | Restart the persistent proxy. |
| `headroom install stop` / `start` | Stop or start the persistent proxy. |
| `headroom mcp status` | Check agent MCP registration and proxy state. |
| `headroom wrap claude` | Launch a one-off Claude session through Headroom. |
| `headroom perf` / `headroom agent-savings` | Inspect savings and runtime behavior. |

## Next

→ a configured OpenAI-compatible chat endpoint
