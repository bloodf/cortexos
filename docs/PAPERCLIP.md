# CortexOS ↔ Paperclip Integration

> Canonical reference for the Paperclip governance plane: architecture,
> auth model, secret rotation, ops runbook, troubleshooting, and historic
> backfill placeholder.

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Authentication model](#authentication-model)
- [Secret rotation](#secret-rotation)
- [Operations runbook](#operations-runbook)
- [Troubleshooting](#troubleshooting)
- [Rollback procedures](#rollback-procedures)
- [Historic backfill](#historic-backfill)
- [Related docs](#related-docs)

## Overview

Paperclip is the **governance plane** for CortexOS: it owns goals,
issues, approvals, monthly budgets, and the audit trail. CortexOS keeps
execution authority — code, infrastructure, NATS subjects, and host
state. The two systems are joined by a thin **bridge** that translates
Paperclip HTTP webhooks into NATS work messages, and NATS status events
back into Paperclip `PATCH /api/issues/:id` calls.

| Layer        | Authority owner | Storage                                |
| ------------ | --------------- | -------------------------------------- |
| Goals        | Paperclip       | Paperclip Postgres                     |
| Issues       | Paperclip       | Paperclip Postgres                     |
| Approvals    | Paperclip       | Paperclip Postgres                     |
| Budgets      | Paperclip       | Paperclip Postgres                     |
| Audit trail  | Paperclip       | Paperclip Postgres                     |
| NATS stream  | CortexOS        | JetStream on host                      |
| Link table   | CortexOS        | `paperclip_ticket_link` (migration 005)|
| Commits      | CortexOS        | Git remotes                            |

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│  Paperclip control plane (Postgres-backed)              │
│  goals · projects · issues · approvals · budgets        │
└──────────────┬──────────────────────────────────────────┘
               │ HTTPS webhook
               │ Authorization: Bearer <PAPERCLIP_WEBHOOK_SECRET>
               ▼
┌─────────────────────────────────────────────────────────┐
│  stacks/cortex-paperclip-bridge                         │
│   server.js   POST /paperclip/heartbeat → publish NATS  │
│   worker.js   NATS cortex.paperclip.status.* → PATCH    │
│   alerts.js   NATS cortex.alerts.*       → notification │
│  Postgres link: paperclip_ticket_link                   │
└──────────────┬─────────────────────────────┬────────────┘
   cortex.paperclip.work.<role>   cortex.paperclip.status.<role>
               ▼                             ▲
┌─────────────────────────────────────────────────────────┐
│  stacks/cortex-consumer/consumer.js                     │
│   durable: cortex-consumer-paperclip-work               │
│   publishes: cortex.paperclip.status.<role>             │
└──────────────┬──────────────────────────────────────────┘
               ▼
        OMC factory · planner → executor → verifier
               ▼
        git commits / deploys / code changes
```

NATS subject taxonomy (canonical schema in `docs/NATS-CONTRACT.md`):

| Subject                             | Direction       | Producer    |
| ----------------------------------- | --------------- | ----------- |
| `cortex.paperclip.work.<role>`      | bridge → consumer  | server.js   |
| `cortex.paperclip.status.<role>`    | consumer → bridge  | consumer.js |
| `cortex.paperclip.approval.<role>`  | consumer → bridge  | consumer.js |
| `cortex.alerts.<severity>.<source>` | dashboard → bridge | dashboard   |

## Authentication model

Two layers, both required:

1. **Bearer (inbound, Paperclip → bridge).** Every webhook carries
   `Authorization: Bearer $PAPERCLIP_WEBHOOK_SECRET`. The bridge verifies
   with `crypto.timingSafeEqual` on length-equal buffers. Mismatched
   length, missing header, or wrong value all return `401` in constant
   time. Source of truth: `stacks/cortex-paperclip-bridge/server.js`.
2. **HMAC (NATS, bridge ↔ consumer).** Every NATS message on
   `cortex.paperclip.*` carries an HMAC-SHA256 header keyed on
   `CORTEX_NATS_HMAC`. The consumer drops any message that fails HMAC
   verification (no DLQ on auth failure — pure drop, logged).
3. **Bearer (outbound, bridge → Paperclip).** Worker PATCHes use
   `Authorization: Bearer $PAPERCLIP_API_KEY` plus
   `X-Paperclip-Run-Id: <runId>` for idempotency.

Idempotency:

- `paperclip_ticket_link.paperclip_run_id` has a `UNIQUE` constraint.
- Replay of a previous webhook body returns `202` to Paperclip but
  refuses to insert a duplicate row.

## Secret rotation

Rotation cadence: every 90 days, or immediately on suspected exposure.

| Secret                       | File / location                                  | Rotation owner |
| ---------------------------- | ------------------------------------------------ | -------------- |
| `PAPERCLIP_WEBHOOK_SECRET`   | `/opt/cortexos/.secrets/paperclip.env` (chmod 600) | Bridge operator |
| `PAPERCLIP_API_KEY`          | `/opt/cortexos/.secrets/paperclip.env`           | Board admin    |
| `CORTEX_NATS_HMAC`           | `/opt/cortexos/.secrets/nats.env`                | NATS operator  |
| Per-agent key                | `/opt/cortexos/.secrets/paperclip-keys.json`     | Role registrar |

Rotation steps for `PAPERCLIP_WEBHOOK_SECRET`:

```bash
# 1. Mint a new value.
new=$(openssl rand -hex 32)

# 2. Update both ends, bridge first.
sudo sed -i "s|^PAPERCLIP_WEBHOOK_SECRET=.*|PAPERCLIP_WEBHOOK_SECRET=${new}|" \
  /opt/cortexos/.secrets/paperclip.env
sudo systemctl restart cortex-paperclip-bridge

# 3. Update Paperclip-side webhook config to the same value.
#    (Board UI → integrations → cortex bridge → rotate.)

# 4. Run the smoke. Step 15 MUST be 401 (old secret), step 1 PASS.
scripts/paperclip-smoke-test.sh --phase P4
```

The new value is hot — `restart` is required because Node reads env once
at boot.

## Operations runbook

### Start / stop / restart

```bash
# Host-systemd mode
sudo systemctl start   cortex-paperclip-bridge
sudo systemctl stop    cortex-paperclip-bridge
sudo systemctl restart cortex-paperclip-bridge
sudo systemctl status  cortex-paperclip-bridge

# Compose mode
cd /opt/cortexos/stacks/cortex-paperclip-bridge
docker compose up -d
docker compose stop
docker compose restart
docker compose ps
```

### Health probe

```bash
curl -fsS http://127.0.0.1:8089/healthz
# expect: {"status":"ok","version":"<sha>","uptime_sec":<n>}
```

### Smoke (preferred end-to-end probe)

```bash
scripts/paperclip-smoke-test.sh --phase P4 > /tmp/smoke.json 2> /tmp/smoke.log
jq '.result, .failure' /tmp/smoke.json
```

See `prompts/paperclip/60-smoke-test.md` for the full operator script.

### Common queries

```sql
-- Active runs.
SELECT paperclip_issue_id, cortex_role, status, cost_usd_cents, updated_at
FROM paperclip_ticket_link
WHERE status IN ('open','in_progress')
ORDER BY created_at DESC;

-- Recent failures.
SELECT paperclip_issue_id, cortex_role, status, updated_at
FROM paperclip_ticket_link
WHERE status IN ('failed','cancelled')
  AND updated_at > now() - interval '24 hours'
ORDER BY updated_at DESC;
```

## Troubleshooting

Failure tags from `scripts/paperclip-smoke-test.sh` (full list in
`prompts/paperclip/60-smoke-test.md`):

| Tag                          | Triage                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| `SMOKE-FAIL:env-missing`     | Source `paperclip.env`; verify all six required vars.             |
| `SMOKE-FAIL:bridge-healthz`  | Service down. Check `journalctl -u cortex-paperclip-bridge`.       |
| `SMOKE-FAIL:nats-unreachable`| NATS down or wrong URL.                                           |
| `SMOKE-FAIL:pg-table-missing`| Migration 005 not applied.                                        |
| `SMOKE-FAIL:role-not-registered` | Run `scripts/paperclip-register-roles.ts`.                    |
| `SMOKE-FAIL:bridge-ack-timeout`  | Bridge accepted webhook but never wrote link row.             |
| `SMOKE-FAIL:nats-work-missed`    | Bridge HMAC mismatch or NATS connection drop.                 |
| `SMOKE-FAIL:consumer-no-claim`   | Consumer durable paused or filter wrong.                      |
| `SMOKE-FAIL:status-patch-missing`| Worker error; check retry-storm logs.                         |
| `SMOKE-FAIL:replay-not-idempotent`  | `UNIQUE(paperclip_run_id)` missing — re-apply migration 005. |
| `SMOKE-FAIL:wrong-bearer-not-401`   | Auth regression. SECURITY incident.                        |
| `SMOKE-FAIL:length-mismatch-not-401`| `timingSafeEqual` length-leak. SECURITY incident.          |
| `SMOKE-FAIL:approval-bypass`        | Approval gate not enforced. SECURITY incident.             |
| `SMOKE-FAIL:budget-not-enforced`    | Cost accounting regression in consumer.                    |
| `SMOKE-FAIL:approval-no-timebox`    | Approval queue unbounded. Restore default timeout.         |
| `SMOKE-FAIL:selinux-not-enforcing`  | Fedora/RHEL host permissive. `selinux_set enforcing`.       |

## Rollback procedures

Long-form drill in `prompts/paperclip/70-rollback.md`. Summary by phase:

| Phase | What rolls back                                    | Time target |
| ----- | -------------------------------------------------- | ----------- |
| P2    | Bridge service + migration 005 + consumer revert   | < 15 min    |
| P3    | Frontmatter + dashboard panel + paused routines    | < 10 min    |
| P4    | Docs + workflow disable (no host state)            | < 5 min     |
| P5    | npm unpublish or patch revert; bridge falls back   | < 30 min    |
| P7    | `006_paperclip_omc_backfill.rollback.sql`          | < 10 min    |
| P8    | `BRIDGE_ALERTS_ENABLED=0`; revert publisher commit | < 5 min     |

The drill is part of the phase "done" checklist.

## Historic backfill

Placeholder for Phase 7 (`prompts/paperclip/80-historic-backfill.md`).
That phase ports archived `.omx/` and `.omc/` task records into
Paperclip with status `done`, links each via
`paperclip_ticket_link.omc_task_id`, and is gated on a mandatory dry-run
plus row-count parity check. Expanded notes will land here when P7
ships.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
- [NATS contract](NATS-CONTRACT.md)
- [Setup guide](SETUP_GUIDE.md)
- [Smoke prompt](../prompts/paperclip/60-smoke-test.md)
- [Rollback prompt](../prompts/paperclip/70-rollback.md)
