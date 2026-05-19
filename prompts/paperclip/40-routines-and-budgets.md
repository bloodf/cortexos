# Paperclip ↔ CortexOS — Routines and Budgets

> Stage 4. Run after `30-register-roles.md` CHECKPOINT 3.A passes.

## Goal

Tune the per-role heartbeat cadence (`routine`) and monthly budget
(`monthlyBudgetUsd`) for production traffic. All tuning is done by editing the
frontmatter in `templates/agent-roles/*.md` and re-running the registration
script.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Defaults
- [ ] When to tune
- [ ] Procedure
- [ ] CHECKPOINT 4.A confirmed

## Defaults

| Role            | Routine (cron)     | Monthly budget (USD) |
| --------------- | ------------------ | -------------------- |
| CEO             | `0 */15 * * * *`   | 500                  |
| CTO             | `0 */15 * * * *`   | 400                  |
| PM / PO         | `0 */15 * * * *`   | 200                  |
| STAFF-ENG       | `0 */15 * * * *`   | 300                  |
| CORTEX          | `0 */15 * * * *`   | 300                  |
| ENG-*           | `0 */15 * * * *`   | 200                  |
| ENGINEER        | `0 */15 * * * *`   | 200                  |
| UXUI            | `0 */15 * * * *`   | 150                  |
| QA              | `0 */15 * * * *`   | 100                  |
| BOOK-*          | `0 */15 * * * *`   | 50                   |

The default cadence (`0 */15 * * * *` — every 15 minutes) is intentionally
conservative. It keeps the Paperclip bill predictable while leaving headroom
for event-driven NATS wakeups outside the cron schedule.

## When to tune

Tighten cadence (`0 */5 * * * *`, every 5 minutes) for:

- Roles owning latency-sensitive flows (QA gating, incident response).
- Roles wired to alert subjects with strict SLA (`cortex.alerts.critical.*`).

Loosen cadence (`0 0 * * * *`, hourly) for:

- BOOK-* roles during writing-light periods.
- Roles with no active backlog (parked engineers).

Raise budget when the previous month's spend exceeded 80% of the cap and
escalations to CEO are blocking work. Never raise budget without an explicit
CFO/CEO sign-off recorded in the project Slack thread.

## Procedure

1. Edit the relevant role file:

   ```bash
   $EDITOR /opt/cortexos/templates/agent-roles/ENG-BACKEND.md
   ```

   Update only the `paperclip:` block; leave the markdown body unchanged.

2. Re-run the registration script. Existing roles are detected and **updated
   in place** via the Paperclip hire API (idempotent path); no new key is
   minted.

   ```bash
   sudo -u cortex env $(sudo grep -v '^#' /opt/cortexos/.secrets/paperclip.env | xargs) \
     tsx scripts/paperclip-register-roles.ts
   ```

3. Confirm the new routine/budget in the Paperclip UI.

## CHECKPOINT 4.A

**STOP — operator question:** Verify this checkpoint's preconditions are met?

- [ ] Frontmatter changes committed to the cortexos repo (audit trail).
- [ ] Paperclip UI reflects the new cadence/budget for every edited role.
- [ ] No unexpected `minted=N` for N > 0 after a routine-only change.

Type `confirmed` to proceed.
