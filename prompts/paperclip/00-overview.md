# Paperclip ↔ CortexOS — Overview

> Stage 0 of the Paperclip integration. Read before running install or bridge prompts.

## Todo

- [ ] What is Paperclip
- [ ] Why we use it
- [ ] Bridge architecture
- [ ] Subject reservations
- [ ] CHECKPOINT 0.A confirmed

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

**STOP — operator question:** Verify this checkpoint's preconditions are met?

- [ ] Tailscale up and Paperclip host reachable.
- [ ] Postgres reachable, NATS reachable.
- [ ] `cortex` user/group present.
- [ ] `/opt/cortexos/.secrets/` exists, mode 0700.

Type `confirmed` to proceed.
