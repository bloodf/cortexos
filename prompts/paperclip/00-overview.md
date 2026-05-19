# Paperclip ↔ CortexOS — Overview

> Stage 0 of the Paperclip integration. Read before running install or bridge prompts.

## Todo

- [ ] Read "What is Paperclip" + "Why we use it"
- [ ] Review bridge architecture diagram
- [ ] Review subject reservations table
- [ ] CHECKPOINT 0.A confirmed — Tailscale up
- [ ] CHECKPOINT 0.B confirmed — Postgres reachable
- [ ] CHECKPOINT 0.C confirmed — NATS reachable
- [ ] CHECKPOINT 0.D confirmed — `cortex` user/group exists
- [ ] CHECKPOINT 0.E confirmed — `/opt/cortexos/.secrets/` mode 0700

## What is Paperclip

Paperclip is a self-hosted issue/run orchestration platform. It manages agent identity, issue assignments, run keys, approvals, and a structured inbox. CortexOS uses Paperclip as the **work source** and **status sink** for role-scoped agent runs (`ENG-BACKEND`, `ENG-FRONTEND`, `SECURITY`, `OPS`, etc.).

## Why we use it

- Single canonical issue/run identity per CortexOS task.
- Approval and hire flows decoupled from NATS internals.
- Webhook-driven wake — no polling.
- Standard Paperclip fields always win over CortexOS `payloadTemplate` keys, keeping the contract stable across role rollouts.

## Prerequisites

Before continuing to `10-install.md`:

- Tailscale up on the VPS (Paperclip is Tailscale-only; never expose publicly).
- Postgres reachable at `127.0.0.1:5432` with database `cortex` (migration 005 will add `paperclip_ticket_link`).
- NATS reachable at `127.0.0.1:4222` with stream `CORTEX` already provisioned by `cortex-consumer`.
- `cortex` system user/group exist (created by `scripts/provision-vps.sh`).
- `/opt/cortexos/.secrets/` exists, owned `cortex:cortex`, mode `0700`.

## Bridge architecture

```text
┌──────────┐   POST /paperclip/heartbeat   ┌──────────┐  cortex.paperclip.work.<role>   ┌────────────────┐
│ Paperclip│ ─────────────────────────────▶│  Bridge  │ ───────────────────────────────▶│ cortex-consumer│
└──────────┘                               └──────────┘                                 └────────────────┘
      ▲                                          │                                              │
      │   PATCH /api/issues/:id                  │  cortex.paperclip.status.<role>              │
      └──────────────────────────────────────────┴──────────────────────────────────────────────┘
```

## Subject reservations

| Subject | Direction | Owner |
|---|---|---|
| `cortex.paperclip.work.<role>` | bridge → consumer | P2 (this phase) |
| `cortex.paperclip.status.<role>` | consumer → bridge | P2 |
| `cortex.paperclip.approval.<role>` | reserved | P3 governance |

## CHECKPOINT 0.A

**STOP — operator question:** Does `tailscale status | head -1` print a non-`Logged out` line containing the local hostname (not `failed to connect`, not `command not found`)?

Type `confirmed` to proceed.

## CHECKPOINT 0.B

**STOP — operator question:** Does `pg_isready -h 127.0.0.1 -p 5432` print `accepting connections` (not `no response`)?

Type `confirmed` to proceed.

## CHECKPOINT 0.C

**STOP — operator question:** Does `nc -zv 127.0.0.1 4222` print `succeeded` (not `Connection refused`)?

Type `confirmed` to proceed.

## CHECKPOINT 0.D

**STOP — operator question:** Does `getent passwd cortex && getent group cortex` print two non-empty lines (not empty, not exit 2)?

Type `confirmed` to proceed.

## CHECKPOINT 0.E

**STOP — operator question:** Does `stat -c '%a' /opt/cortexos/.secrets` print `700` (not `755`, not `No such file`)?

Type `confirmed` to proceed.
