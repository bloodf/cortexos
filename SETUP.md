# CortexOS — Initial Setup

Orchestrator prompt for hub-and-spoke VPS configuration. This file drives the full install sequence: questionnaire → pre-flight → spoke execution → validation. Each spoke is a self-contained AI-agent prompt in `prompts/tools/`.

> **Assumed starting state:** the operator already has this repository cloned on the target host (typically `/opt/cortexos` or the user's home). The agent must NOT re-clone or re-fetch the repository — it operates against the working tree it is invoked from. If the laptop-driven bootstrap path is preferred, see `prompts/00-bootstrap.md` instead.
>
> **Pre-install requirements:** before opening this file, the VPS must
> have Node 24, an AI coding agent CLI (Claude Code / Codex / Cursor),
> Tailscale joined to your tailnet, and the supporting CLI tools (`sops`,
> `cosign`, `syft`, `gh`, `age`, `jq`, `git`, `curl`) installed. See
> [REQUIREMENTS.md](REQUIREMENTS.md) for the full pre-install checklist.

---

## Questionnaire

Answer all questions before the agent proceeds. Set values as shell env vars.

```bash
# 1. VPS access
export CORTEX_USER=""                   # Non-root sudo user on the VPS
export CORTEX_HOSTNAME="cortex"         # Short hostname (e.g. cortex)
export CORTEX_IP=""                     # VPS public or LAN IP
export SSH_PORT="22"                    # SSH port (default 22)

# 2. Domain
export CORTEX_DOMAIN=""                 # Public domain (e.g. cortex.example.com)
                                        # Can be a Tailscale FQDN or custom DNS

# 3. Tailscale
# No token needed at setup time — `prompts/tools/12-tailscale.md` runs
# `tailscale up` interactively and you sign in through the browser URL it
# prints. Skip this section.

# 4. AI providers (default: 9Router handles all; add keys for providers you have)
export OPENAI_API_KEY=""
export ANTHROPIC_API_KEY=""
export NINE_ROUTER_API_KEY=""          # Master key for 9Router (generate a random string)

# 5. Messaging platforms — deferred
# Telegram, Slack, Discord, and WhatsApp tokens are NOT needed at setup time.
# Add each platform's secrets to /opt/cortexos/.secrets/<platform>.env (or via
# the encrypted templates under templates/.secrets/) only when you actually
# wire that integration up via its dedicated prompt under `prompts/integrations/`.

# 6. Optional services
export INSTALL_MONGODB="no"            # yes|no — default no
export INSTALL_JELLYFIN="no"           # yes|no
export INSTALL_HOME_ASSISTANT="no"     # yes|no

# 7. Generated secrets (fill these in or let the agent generate them)
export DASHBOARD_DB_PASSWORD=""        # PostgreSQL password for dashboard role
export REDIS_PASSWORD=""
export GRAFANA_ADMIN_PASSWORD=""
export CORTEX_MASTER_KEY=""            # Random 32-byte hex for dashboard session signing
export KERNEL_BROWSER_TOKEN=""
export AGENTGATEWAY_TOKEN_SECRET=""
```

> Projects are NOT configured here. Register projects via the dashboard Projects page after the VPS is running (`https://{CORTEX_DOMAIN}/en/admin/projects`).

---

## Pre-flight Verification

Before executing any spoke, the agent must complete all steps below. **BLOCKS** — do not proceed if any step fails.

### Step A — Hardware and OS

```bash
# Minimum: Ubuntu 22.04+, 4 cores, 16 GB RAM, 100 GB disk
lsb_release -a
nproc && free -h && df -h /
```

### Step B — SSH and sudo

```bash
sudo whoami   # Must return: root
```

### Step C — Snapshot external docs

Run spoke `prompts/tools/00-preflight.md`. This probe:

- Verifies OpenClaw gateway is reachable (or that `40-openclaw.md` will install it).
- Snapshots all upstream documentation into `docs/external/*.snapshot.md`.
- Writes initial `.secrets/.setup-state.json`.

### Step D — OpenClaw version check

```bash
openclaw --version 2>/dev/null || echo "NOT_INSTALLED"
```

If `NOT_INSTALLED`: note that `40-openclaw.md` will install it. Pre-flight continues.
If installed: confirm version is from upstream HEAD (no pinned older version).

---

## Install Order

The agent computes topological sort from `prompts/tools/_order.md`. Enabled spokes only (skip `16-mongodb` unless `INSTALL_MONGODB=yes`).

Default linear order (no optional services):

```text
00-preflight → 10-os-hardening → 11-docker → 12-tailscale → 13-caddy
→ 14-postgresql → 15-redis → 17-dnsmasq → 18-fail2ban
→ 20-prometheus → 21-loki → 22-grafana → 23-fluent-bit → 24-cadvisor → 25-node-exporter
→ 30-nats → 31-9router → 32-openviking → 33-leann → 34-kernel-browser → 35-opik
→ 40-openclaw → 41-openclaw-channels → 42-openclaw-openviking → 43-openclaw-memory-core
→ 44-openclaw-a2a-gateway → 45-openclaw-compaction → 46-openclaw-codex-watchdog
→ 47-openclaw-foundry → 48-openclaw-opik → 49-openclaw-account-ops
→ 50-agentgateway → 60-cortex-consumer → 70-dashboard → 80-agent-factory → 81-projects
→ 99-final-validation
```

If `INSTALL_MONGODB=yes`, insert `16-mongodb` after `15-redis`.

---

## Execution Protocol

For each spoke:

1. Agent reads `prompts/tools/<spoke>.md`.
2. Agent executes each step in order.
3. At each `## CHECKPOINT N` section, agent **stops** and reports status to operator.
4. Operator verifies and responds "confirmed" to continue.
5. Agent marks spoke complete in `.secrets/.setup-state.json`.

State file format:

```json
{
  "preflight": { "probe_exit_code": 0, "probe_timestamp": "..." },
  "completed_spokes": ["00-preflight", "10-os-hardening", "..."],
  "last_spoke": "...",
  "last_checkpoint": 2
}
```

If interrupted, re-run from the last incomplete spoke. The state file prevents double-execution.

---

## AI Agent Requirements

Tested with Claude Code, Cursor, and Codex CLI. The agent must be able to:

- Open SSH to `{CORTEX_IP}` as `{CORTEX_USER}`.
- Read all files under `prompts/` and `templates/` (local repo).
- Write files to `/opt/cortexos/...` on the VPS via SSH.
- Run shell commands with sudo on the VPS.

Plain Markdown fallback: every spoke can be read and executed manually in a terminal.

---

## Placeholders Reference

| Placeholder | Meaning | Set via |
|---|---|---|
| `{VPS_HOSTNAME}` | Short hostname | `CORTEX_HOSTNAME` |
| `{VPS_USER}` | OS sudo user | `CORTEX_USER` |
| `{DOMAIN}` | Public-facing domain | `CORTEX_DOMAIN` |
| `{SSH_PORT}` | SSH port | `SSH_PORT` |
| `{9ROUTER_API_KEY}` | 9Router master key | `NINE_ROUTER_API_KEY` |
| `{DASHBOARD_DB_PASSWORD}` | PG dashboard password | `DASHBOARD_DB_PASSWORD` |
| `{REDIS_PASSWORD}` | Redis password | `REDIS_PASSWORD` |
| `{GRAFANA_ADMIN_PASSWORD}` | Grafana admin password | `GRAFANA_ADMIN_PASSWORD` |
| `{CORTEX_MASTER_KEY}` | Dashboard session key | `CORTEX_MASTER_KEY` |

---

## Start

Begin here:

```text
Read and execute: prompts/tools/00-preflight.md
```

After preflight, proceed through the install order above, one spoke at a time.
