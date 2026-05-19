# CortexOS Setup Guide

> Operator-oriented guide for deploying CortexOS through checkpointed prompt modules.
>
> **v4.5 install model — laptop drives, VPS receives.** Operator clones
> this repository on a workstation, sets `CORTEX_HOST/USER/ROOT/DOMAIN`,
> and opens [`prompts/00-bootstrap.md`](../prompts/00-bootstrap.md) in an
> AI coding agent. The bootstrap prompt SSH-dispatches every install
> step from the laptop to the VPS via `scripts/bootstrap.sh`. The
> operator age **private** key lives only on the laptop; the VPS never
> sees it.

## Contents

- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Execution model](#execution-model)
- [Prompt sequence](#prompt-sequence)
- [Verification](#verification)
- [FAQ](#faq)
- [Related docs](#related-docs)

## Prerequisites

| Requirement | Recommended value |
|---|---|
| OS | Ubuntu 24.04 LTS, Ubuntu 25.x, or Debian 13 (Trixie) |
| CPU | 4+ cores |
| Memory | 16 GB+ |
| Disk | 200 GB+ SSD |
| Access | SSH key-based auth from the operator laptop to the VPS as a sudo user |
| Network | Domain or Tailscale hostname |
| Tools (laptop) | `git`, `ssh`, `scp`, `sops`, `age`, AI coding agent |
| Tools (VPS) | Whatever the OS ships with; the bootstrap pushes everything else |

Before running any module, pick a distro family with
[`prompts/os/00-os-selection.md`](../prompts/os/00-os-selection.md);
it exports `CORTEX_OS_FAMILY` and gates every package-management call
through `scripts/pkg.sh`. Distro-specific prereqs live in
`prompts/os/10-ubuntu-prereqs.md` (used for both Ubuntu and Debian — apt-based path).

## Environment variables

```bash
export CORTEX_HOST=<vps-host>
export CORTEX_USER=<sudo-user>
export CORTEX_ROOT=/opt/cortexos
export CORTEX_DOMAIN=<dashboard-domain>
```

Keep secrets outside shell history when possible. Use prompt-specific secure input instructions.

## Execution model

[`prompts/00-bootstrap.md`](../prompts/00-bootstrap.md) is the master
prompt. It runs on the **operator laptop** and SSH-dispatches every
install step to the VPS via helpers in
[`scripts/bootstrap.sh`](../scripts/bootstrap.sh):

- `bootstrap_check_local_deps` — verifies `ssh/scp/git/sops/age` and the
  four `CORTEX_*` env vars on the laptop.
- `bootstrap_ensure_operator_age_key` — creates / discovers
  `~/.config/sops/age/keys.txt` and prints the public recipient for
  `.sops.yaml`.
- `bootstrap_detect_remote_os` — pipes `scripts/os-detect.sh` to the
  VPS over SSH and exports `CORTEX_OS_FAMILY` / `CORTEX_OS_VERSION` in
  the laptop shell.
- `bootstrap_push_repo` — materializes the working tree at
  `/opt/cortexos` on the VPS using `git archive | ssh tar -x`.
- `bootstrap_run_remote <cmd>` — runs `<cmd>` on the VPS with the
  CortexOS env exported. This is the wrapper used to execute every
  shell block in `prompts/os/*` and `prompts/tools/*`.
- `bootstrap_push_secrets` — decrypts every
  `templates/.secrets/*.enc.yaml` locally with the operator age key,
  scp's plaintext `.env` files to `/opt/cortexos/.secrets/`, and chmods
  them to `0600` on the VPS.

Prompts remain plain Markdown so an operator can fall back to running
them manually on the VPS if SSH dispatch is unavailable. Legacy
on-host invocation continues to work for `provision-vps.sh` and the
prompt steps themselves.

## Prompt sequence

The bootstrap dispatches every step under `prompts/os/*` and `prompts/tools/*`. The canonical order is encoded in [`prompts/tools/_order.md`](../prompts/tools/_order.md). Key v2 steps:

| Module | Purpose |
|---|---|
| `prompts/os/00-os-selection.md` | Detect / pick `CORTEX_OS_FAMILY` (Ubuntu 24 / 25 or Debian 13) |
| `prompts/os/10-ubuntu-prereqs.md` | Apt-based prereqs for Debian-family hosts |
| `prompts/tools/00-preflight.md` | Host preflight + invariants |
| `prompts/tools/10-os-hardening.md` | Kernel + sysctl + auditd |
| `prompts/tools/11-docker.md` | Docker engine + compose plugin |
| `prompts/tools/12-tailscale.md` | Tailscale-first networking |
| `prompts/tools/12a-sops-bootstrap.md` | Install `sops` + `age` on the VPS; register operator recipient |
| `prompts/tools/13-caddy.md` | Caddy + TLS |
| `prompts/tools/14-postgresql.md` | PostgreSQL + TimescaleDB extension |
| `prompts/tools/15-redis.md` | Redis |
| `prompts/tools/18-fail2ban.md` | fail2ban |
| `prompts/tools/20-prometheus.md` ... `25-node-exporter.md` | Prometheus / Loki / Grafana / Fluent Bit / cAdvisor / node-exporter |
| `prompts/tools/30-nats.md` | NATS JetStream with the streams listed in [NATS-CONTRACT.md](NATS-CONTRACT.md) |
| `prompts/tools/45a-cortex-graph.md` | Deploy `stacks/cortex-graph` (LangGraph sidecar + PG checkpointer) |
| `prompts/tools/47a-cortex-sandbox.md` | Deploy `stacks/cortex-sandbox-runner` (gVisor / `runsc`) |
| `prompts/tools/55-langfuse.md` | Deploy self-hosted Langfuse + ClickHouse for LLM traces |
| `prompts/tools/60-cortex-consumer.md` | Deploy the durable consumer with envelope validation enabled |
| `prompts/tools/70-dashboard.md` | Build the dashboard on the VPS via `docker compose build` (no rsync) |
| `prompts/tools/99-final-validation.md` | End-to-end validation + credential export |

## Paperclip governance plane (required)

After module 13, every operator runs the Paperclip prompts in order.
Paperclip is the governance plane for CortexOS — goals, approvals, and
budgets flow through it — and is **not optional**:

| Prompt                                         | Stage                            |
|------------------------------------------------|----------------------------------|
| `prompts/paperclip/00-overview.md`             | Authority split + decision gate  |
| `prompts/paperclip/10-install.md`              | Install bridge dependencies      |
| `prompts/paperclip/20-bridge.md`               | Bring up the bridge service      |
| `prompts/paperclip/30-register-roles.md`       | Register CortexOS roles          |
| `prompts/paperclip/40-routines-and-budgets.md` | Configure routines + budgets     |
| `prompts/paperclip/50-approval-gates.md`       | Wire approval gates              |
| `prompts/paperclip/60-post-install-validation.md` | Run end-to-end 28-step validation |
| `prompts/paperclip/70-rollback.md`             | Practice rollback drill          |

The Paperclip layer is mandatory. Bootstrap is not complete until these
prompts have been run and validated. See [PAPERCLIP.md](PAPERCLIP.md)
for architecture and ops runbook.

## Verification

After each checkpoint, confirm service health, file ownership, logs, dashboard registry, and rollback path. Do not continue when prompt verification fails.

## FAQ

**Can existing PostgreSQL be used?** Yes. Skip install commands and set `DATABASE_URL` in `/opt/cortexos/secrets/dashboard.env`.

**Can agent factory be skipped?** Yes. Dashboard and infrastructure can run without modules 06, 09, and 11.

**Where are credentials stored?** Host files under `/opt/cortexos/.secrets` and encrypted dashboard rows after import.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
