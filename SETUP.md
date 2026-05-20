# CortexOS — Initial Setup

Orchestrator prompt for hub-and-spoke VPS configuration. This file drives the full install sequence: questionnaire → pre-flight → spoke execution → validation. Each spoke is a self-contained AI-agent prompt in `prompts/tools/`.

> **Assumed starting state:** the operator already has this repository cloned on the target host (typically `/opt/cortexos` or the user's home). The agent must NOT re-clone or re-fetch the repository — it operates against the working tree it is invoked from. If the laptop-driven bootstrap path is preferred, see `prompts/00-bootstrap.md` instead.
>
> **Pre-install requirements:** before opening this file, the VPS must
> have Node 24, an AI coding agent CLI (Claude Code / Codex / Cursor),
> Tailscale joined to your tailnet, and the supporting CLI tools (`sops`,
> `cosign`, `syft`, `gh`, `age`, `jq`, `git`, `curl`, `pnpm >= 9`)
> installed. See [REQUIREMENTS.md](REQUIREMENTS.md) for the full
> pre-install checklist.
>
> The full required-tool list is enforced automatically by
> `scripts/preflight-tools.sh`, which runs after `prompts/os/10-ubuntu-prereqs.md` on the VPS before any spoke
> executes. If anything is missing it prints a numbered remediation list
> and exits 2 — install the items and re-run.

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
# Default: use the Tailscale MagicDNS FQDN of this node — e.g.
#   cortex.tailXXXX.ts.net  (read from `tailscale status` after 12-tailscale.md)
# Tailscale Serve terminates HTTPS with auto-issued certs; no public DNS or
# Let's Encrypt account needed. Set a real public domain ONLY if you want the
# dashboard exposed on the open internet (see 13-caddy.md "Public-domain
# override").
export CORTEX_DOMAIN=""                 # e.g. cortex.tailXXXX.ts.net

# 3. Tailscale
# No token needed at setup time — `prompts/tools/12-tailscale.md` runs
# `tailscale up` interactively and you sign in through the browser URL it
# prints. Skip this section.

# 4. AI providers (default: 9Router handles all; add keys for providers you have)
export OPENAI_API_KEY=""
export ANTHROPIC_API_KEY=""
export NINEROUTER_API_KEY=""           # Master key for 9Router (generate a random string)

# 5. Messaging platforms — deferred
# Telegram, Slack, Discord, and WhatsApp tokens are NOT needed at setup time.
# Add each platform's secrets to /opt/cortexos/.secrets/<platform>.env (or via
# the encrypted templates under templates/.secrets/) only when you actually
# enable that channel through `prompts/tools/41-openclaw-channels.md` or the OpenClaw CLI after install.

# 6. Optional services
export INSTALL_MONGODB="no"            # yes|no
export INSTALL_MYSQL="no"              # yes|no
export INSTALL_JELLYFIN="no"           # yes|no
export INSTALL_HOME_ASSISTANT="no"     # yes|no
export INSTALL_PGADMIN="yes"           # yes|no — PostgreSQL web admin
export INSTALL_REDISINSIGHT="yes"      # yes|no — Redis GUI
export INSTALL_MONGO_EXPRESS="no"      # yes|no — MongoDB web admin (requires INSTALL_MONGODB)
export INSTALL_PHPMYADMIN="no"         # yes|no — MySQL web admin (requires INSTALL_MYSQL)
export INSTALL_HOMEBREW="yes"          # yes|no — Homebrew for Linux
export INSTALL_WATCHTOWER="yes"        # yes|no — Docker image auto-updates

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

### Step C — Preflight state

Run spoke `prompts/tools/00-preflight.md`. This probe:

- Verifies OpenClaw gateway is reachable (or that `40-openclaw.md` will install it).
- Writes any transient probe output under `/opt/cortexos/.cache/`.
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

> **Checkpoint contract.** Every spoke's `CHECKPOINT N` verifies only state
> owned by that spoke. A spoke MUST NOT verify a service installed by a
> later spoke; if it detects pre-existing optional state, it records
> `NOT_INSTALLED` and continues. Cross-service flows are verified once in
> `99-final-validation`. See [prompts/CHECKPOINT-PATTERN.md](prompts/CHECKPOINT-PATTERN.md).

Default linear order (no optional services). This is the authoritative
sequence the agent MUST follow; it matches `prompts/tools/_order.md`
and includes every required spoke present on disk:

```text
00-preflight
→ 10-os-hardening → 09-homebrew → 11-docker → 12-tailscale → 12a-sops-bootstrap → 13-caddy
→ 14-postgresql → 15-redis → 17-dnsmasq → 18-fail2ban
→ 20-prometheus → 21-loki → 22-grafana → 23-fluent-bit → 24-cadvisor → 25-node-exporter
→ 30-nats → 31-9router → 32-openviking → 33-leann → 34-kernel-browser
→ 40-openclaw → 41-openclaw-channels → 42-openclaw-openviking → 43-openclaw-memory-core
→ 44-openclaw-a2a-gateway → 45-openclaw-compaction → 45a-cortex-graph
→ 46-openclaw-codex-watchdog → 47-openclaw-foundry → 47a-cortex-sandbox
→ 49-openclaw-account-ops
→ 50-agentgateway → 55-langfuse → 60-cortex-consumer → 61-weekly-synthetic-traffic
→ 62-paperclip → 63-paperclip-alerts → 70-dashboard → 80-agent-factory → 81-projects
→ 99-final-validation
```

If `INSTALL_MONGODB=yes`, insert `16-mongodb` after `15-redis`.

LLM observability runs through `55-langfuse` with OpenLLMetry instrumentation in `packages/cortex-telemetry`. Paperclip install and alert wiring are mandatory install spokes (`62-paperclip`, `63-paperclip-alerts`).

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

## Checkpoint & Resume Protocol

Every spoke contains one or more `## CHECKPOINT N` markers. The agent
treats each as a hard barrier: it stops, prints its current step + a
short status summary, and waits for the operator to type `confirmed`
before continuing. This is what lets you safely interrupt and resume
the install.

### What gets written, per checkpoint

At every checkpoint the agent appends a record to
`.secrets/.setup-state.json` on the VPS BEFORE asking the operator to
confirm:

```json
{
  "schema": 1,
  "started_at": "2026-05-18T22:00:00Z",
  "last_updated": "2026-05-18T22:14:09Z",
  "completed_spokes": ["00-preflight", "10-os-hardening"],
  "current_spoke": "11-docker",
  "last_checkpoint": 2,
  "checkpoints": [
    {
      "spoke": "11-docker",
      "n": 2,
      "ts": "2026-05-18T22:14:09Z",
      "status": "awaiting_operator",
      "evidence": {
        "cmd": "docker version --format '{{.Server.Version}}'",
        "output": "27.4.1"
      }
    }
  ]
}
```

The file is in `.secrets/` so it is gitignored and never leaves the
host. `mode 0600`, owner `${CORTEX_USER}`.

### How to interrupt safely

You can stop the agent at any time at a `CHECKPOINT N` prompt:

1. The current spoke is left as `current_spoke`, the last reached
   checkpoint as `last_checkpoint`, status `awaiting_operator` or
   `interrupted` (set by `Ctrl+C` handler).
2. Nothing destructive runs after a CHECKPOINT until you type
   `confirmed`, so the host is in a known-good state.
3. Note the values of `current_spoke` and `last_checkpoint` in the
   state file before closing the session.

### How to resume

Open `SETUP.md` again in your AI agent and tell it:

```text
Resume install from .secrets/.setup-state.json. Re-read the file,
re-enter the spoke listed in `current_spoke`, jump to step
`last_checkpoint + 1`, and continue.
```

The agent MUST:

1. `jq .` the state file to confirm it is well-formed.
2. Skip every spoke in `completed_spokes`.
3. For `current_spoke`, replay any read-only verification commands
   listed in the spoke up to `last_checkpoint`, but DO NOT re-run
   any package install, file write, or service-restart step that
   appears before that checkpoint — those have already happened.
4. Resume linear execution from the first step AFTER
   `last_checkpoint`.

### Marking a spoke complete

When a spoke's final checkpoint is confirmed, the agent updates the
state file in a single atomic write:

```json
{
  "completed_spokes": [..., "11-docker"],
  "current_spoke": "12-tailscale",
  "last_checkpoint": 0
}
```

### Hard rules

- The agent NEVER edits `.secrets/.setup-state.json` by hand mid-step;
  always whole-file replace with `mktemp && mv` to keep it atomic.
- The agent NEVER skips a checkpoint, even if a spoke looks
  "obviously successful" from logs. Operator confirmation is the
  contract.
- If the state file is missing or corrupted, the agent halts and
  asks the operator which spoke to resume from — it does NOT guess.
- A spoke that fails mid-step records `status: "failed"` with the
  failing command + stderr, then halts. The operator either fixes
  the underlying problem and re-runs the spoke from the top
  (idempotent prompts are written to support this), or restores
  from a prior snapshot.

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
| `{9ROUTER_API_KEY}` | 9Router master key | `NINEROUTER_API_KEY` |
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
