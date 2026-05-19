# 62 — Paperclip one-shot install

## Purpose

Install Paperclip, configure CortexOS bridge credentials, deploy the native `cortex-paperclip-bridge` systemd service, register roles, routines, budgets, and approval gates. Mandatory install spoke.

## Native-first notes

- Bridge runs via systemd, not Docker.
- Dashboard migrations run from `packages/cortex-dashboard/`.
- Paperclip path is Tailscale-only.
- NATS stream is `CORTEX_PAPERCLIP_OPS`; do not rely on legacy `CORTEX`.

## Source: paperclip/00-overview.md


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
- NATS reachable at `127.0.0.1:4222` with stream `CORTEX_PAPERCLIP_OPS` already provisioned by `cortex-consumer`.
- `cortex` system user/group exist (created by `10-os-hardening.md`/system-user setup).
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


## Source: paperclip/10-install.md


> Stage 1. Run after `00-overview.md` checkpoint passes. Operator-facing.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Pin `PAPERCLIP_SHA` to audited commit
- [ ] `npx paperclipai@<SHA> onboard --yes` (company `CortexOS`)
- [ ] Record onboarder-emitted company ID + board token
- [ ] Install `/opt/cortexos/.secrets/paperclip.env` from template (mode 0600, owner cortex:cortex)
- [ ] Fill `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY`, `PAPERCLIP_WEBHOOK_SECRET`, `CORTEX_NATS_HMAC`, `PG_DSN`
- [ ] Create `cortexos-bridge` agent in Paperclip + mint API key
- [ ] CHECKPOINT 1.A confirmed — env file present + permissions correct
- [ ] CHECKPOINT 1.B confirmed — `CORTEX_NATS_HMAC` matches cortex-consumer

## 1. Install Paperclip via onboard CLI

Pin the commit SHA before running so the install is reproducible.

```bash
# Replace <SHA> with the audited commit you intend to deploy.
PAPERCLIP_SHA="<SHA>"
npx --yes "paperclipai@${PAPERCLIP_SHA}" onboard --yes
```

The onboarder will:

1. Provision a local Paperclip stack (Tailscale-only by default).
2. Prompt for company name; use `CortexOS`.
3. Emit a company ID and a board token.

## 2. Capture identifiers

```bash
sudo install -d -o cortex -g cortex -m 0700 /opt/cortexos/.secrets
sudo install -o cortex -g cortex -m 0600 \
  templates/.secrets/paperclip.env.example \
  /opt/cortexos/.secrets/paperclip.env
```

Then edit `/opt/cortexos/.secrets/paperclip.env` and fill:

- `PAPERCLIP_API_URL` — Tailscale URL from the onboarder.
- `PAPERCLIP_API_KEY` — bearer minted via `POST /api/agents/<bridge-agent-id>/keys`.
- `PAPERCLIP_WEBHOOK_SECRET` — generate locally:

  ```bash
  openssl rand -hex 32
  ```

- `CORTEX_NATS_HMAC` — copy from `cortex-consumer` env (must match).
- `PG_DSN` — same DSN dashboard uses.

Re-assert permissions:

```bash
sudo chmod 600 /opt/cortexos/.secrets/paperclip.env
sudo chown cortex:cortex /opt/cortexos/.secrets/paperclip.env
```

## 3. Create the bridge agent in Paperclip

Use the Paperclip UI or API to create an agent named `cortexos-bridge` with role `system`. Mint its key:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer ${BOARD_TOKEN}" \
  "${PAPERCLIP_API_URL}/api/agents/<bridge-agent-id>/keys"
```

Place the returned token into `PAPERCLIP_API_KEY` in the env file.

## CHECKPOINT 1.A

**STOP — operator question:** Does `stat -c '%a %U:%G' /opt/cortexos/.secrets/paperclip.env` print `600 cortex:cortex` (not `644`, not `root:root`)?

Type `confirmed` to proceed.

## CHECKPOINT 1.B

**STOP — operator question:** Does `diff <(sudo grep -E '^CORTEX_NATS_HMAC=' /opt/cortexos/.secrets/paperclip.env) <(sudo grep -E '^CORTEX_NATS_HMAC=' /opt/cortexos/.secrets/consumer.env)` print no output (not a `<`/`>` diff line)?

Type `confirmed` to proceed.

Proceed to `20-bridge.md`.


## Source: paperclip/20-bridge.md


> Stage 2. Run after `10-install.md` CHECKPOINT 1.A passes.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Run `node scripts/migrate.js` from `/opt/cortexos/packages/cortex-dashboard`
- [ ] Verify `\d paperclip_ticket_link` shows the table
- [ ] Bring bridge up via compose (2A) or systemd (2B)
- [ ] Add `/paperclip/heartbeat` reverse_proxy block to Caddyfile + reload
- [ ] `curl http://127.0.0.1:8089/healthz` returns 200
- [ ] Send bearer-protected probe heartbeat; expect HTTP 202 + `status:queued`
- [ ] Confirm new row in `paperclip_ticket_link`
- [ ] CHECKPOINT 2.A confirmed — /healthz returns 200
- [ ] CHECKPOINT 2.B confirmed — probe returns 202 + DB row
- [ ] CHECKPOINT 2.C confirmed — no error lines in bridge logs

## 1. Apply migration 005

```bash
cd /opt/cortexos/packages/cortex-dashboard
node scripts/migrate.js
```

Expected output: `005_paperclip_ticket_link applied`.

Verify:

```bash
sudo -u postgres psql -d cortex -c "\d paperclip_ticket_link"
```

## 2A. Legacy compose path (do not use for native-first installs)

```bash
cd /opt/cortexos/stacks/cortex-paperclip-bridge
docker compose up -d --build
docker compose ps
```

Compose reads `/opt/cortexos/.secrets/paperclip.env`. The container listens on `127.0.0.1:8089`.

## 2. Systemd path (native-first)

```bash
cd /opt/cortexos/stacks/cortex-paperclip-bridge
sudo -u cortex pnpm install --frozen-lockfile --prod
sudo install -m 0644 cortex-paperclip-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-paperclip-bridge
sudo systemctl status cortex-paperclip-bridge
```

## 3. Wire Caddy (public path)

Add to the existing Caddyfile, mirroring how the dashboard route is exposed:

```caddy
handle /paperclip/heartbeat {
  reverse_proxy 127.0.0.1:8089
}
```

Reload Caddy.

## 4. Bridge probe

```bash
# Local healthz (no auth):
curl -fsS http://127.0.0.1:8089/healthz

# Inbound webhook with the configured bearer (loopback):
TOKEN="$(sudo grep -E '^PAPERCLIP_WEBHOOK_SECRET=' /opt/cortexos/.secrets/paperclip.env | cut -d= -f2-)"
curl -fsS -X POST http://127.0.0.1:8089/paperclip/heartbeat \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "runId":"probe_1",
    "agentId":"cortexos-bridge",
    "cortexRole":"ENG-BACKEND",
    "context":{"taskId":"issue_probe","wakeReason":"manual","commentId":null}
  }'
```

Expected: HTTP 202, body `{"runId":"probe_1","status":"queued"}`.

Confirm the link row:

```bash
sudo -u postgres psql -d cortex -c "SELECT paperclip_run_id, cortex_role, status FROM paperclip_ticket_link ORDER BY id DESC LIMIT 1;"
```

## CHECKPOINT 2.A

**STOP — operator question:** Does `curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:8089/healthz` print `200` (not `000`, not `502`)?

Type `confirmed` to proceed.

## CHECKPOINT 2.B

**STOP — operator question:** Did the bearer probe POST return HTTP 202 with body containing `"status":"queued"` AND `psql -tAc "SELECT count(*) FROM paperclip_ticket_link WHERE paperclip_run_id='probe_1'"` print `1` (not `0`, not 401, not 500)?

Type `confirmed` to proceed.

## CHECKPOINT 2.C

**STOP — operator question:** Does `journalctl -u cortex-paperclip-bridge -n 50 --no-pager 2>/dev/null | grep -Ei 'error|fatal' | wc -l` (or `docker compose logs` equivalent) print `0` (not a positive integer)?

Type `confirmed` to proceed.

## Rollback

```bash
sudo systemctl disable --now cortex-paperclip-bridge   # or: docker compose down
sudo -u postgres psql -d cortex -f /opt/cortexos/packages/cortex-dashboard/migrations/005_paperclip_ticket_link.rollback.sql
```


## Source: paperclip/30-register-roles.md


> Stage 3. Run after `20-bridge.md` completes and the Paperclip API is reachable
> from the dashboard host.

## Goal

Hire every CortexOS agent role into the Paperclip company, mint per-agent API
keys, and persist them under `/opt/cortexos/.secrets/paperclip-keys.json`.

Role definitions live in `templates/agent-roles/*.md` as YAML frontmatter under
the `paperclip:` key. The registration script is the only supported path —
do **not** click through the Paperclip UI for routine hires.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Confirm `paperclip.env` has `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY`, `PAPERCLIP_COMPANY_ID`
- [ ] Run `tsx scripts/paperclip-register-roles.ts` as `cortex` user
- [ ] Confirm output reports `minted=18 skipped=0` (first run)
- [ ] Confirm `paperclip-keys.json` mode 0600 owner cortex:cortex
- [ ] Confirm 18 roles present in `paperclip-keys.json`
- [ ] Confirm 18 agents visible in Paperclip UI board
- [ ] Re-run script; confirm `minted=0 skipped=18`
- [ ] CHECKPOINT 3.A confirmed — key file has 18 entries
- [ ] CHECKPOINT 3.B confirmed — re-run is idempotent

## 1. Pre-flight

```bash
test -f /opt/cortexos/.secrets/paperclip.env
sudo grep -E 'PAPERCLIP_(API_URL|API_KEY|COMPANY_ID)' /opt/cortexos/.secrets/paperclip.env
```

Required env (operator-supplied, never committed):

- `PAPERCLIP_API_URL` — e.g. `https://paperclip.internal:8443`
- `PAPERCLIP_API_KEY` — board-level key with `agent.hire` + `agent.key.mint` scope
- `PAPERCLIP_COMPANY_ID` — Paperclip company UUID for this CortexOS host
- `BOARD_TOKEN` (optional) — when set, the script auto-approves each hire
  using `POST /api/approvals/:id/approve`. Omit for two-step approval flows.

## 2. Run the registration script

```bash
cd /opt/cortexos
sudo -u cortex env $(sudo grep -v '^#' /opt/cortexos/.secrets/paperclip.env | xargs) \
  tsx scripts/paperclip-register-roles.ts
```

Expected output:

```text
paperclip-register-roles: minted=18 skipped=0
  keys file: /opt/cortexos/.secrets/paperclip-keys.json
```

Re-running is **idempotent**: roles already present in Paperclip are reported
as `skipped`, and no duplicate keys are minted.

## 3. Verify the key file

```bash
sudo ls -l /opt/cortexos/.secrets/paperclip-keys.json
sudo jq '.keys | map(.role)' /opt/cortexos/.secrets/paperclip-keys.json
```

Expected:

- File mode `-rw-------` (`0600`), owner `cortex:cortex`.
- All 18 roles present: CEO, CTO, PM, PO, STAFF-ENG, ENG-BACKEND,
  ENG-FRONTEND, ENG-MOBILE, ENG-ESP32, ENGINEER, QA, UXUI, CORTEX,
  BOOK-AUTHOR, BOOK-EDITOR, BOOK-EVALUATOR, BOOK-REVIEWER, BOOK-TRANSLATOR.

## 4. Verify in Paperclip UI

Open `${PAPERCLIP_API_URL}/board` and confirm:

- 18 agents listed for the CortexOS company.
- Each agent shows its `cortexRole` tag, configured monthly budget, and the
  default routine `0 */15 * * * *`.
- The `Approvals` queue is empty (or matches `BOARD_TOKEN` policy).

## CHECKPOINT 3.A

**STOP — operator question:** Does `sudo jq '.keys | length' /opt/cortexos/.secrets/paperclip-keys.json` print `18` (not `0`, not a smaller number)?

Type `confirmed` to proceed.

## CHECKPOINT 3.B

**STOP — operator question:** Does re-running `tsx scripts/paperclip-register-roles.ts` print `minted=0 skipped=18` (not any `minted=N` where N > 0, not error)?

Type `confirmed` to proceed.

Proceed to `40-routines-and-budgets.md` once 3.B passes.


## Source: paperclip/40-routines-and-budgets.md


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

- [ ] Review defaults table (per-role cron + USD/month)
- [ ] Review tightening/loosening guidelines
- [ ] Edit `paperclip:` frontmatter block in target role file
- [ ] Re-run `tsx scripts/paperclip-register-roles.ts` (idempotent path)
- [ ] Confirm Paperclip UI shows new cadence/budget
- [ ] Commit frontmatter changes to repo (audit trail)
- [ ] CHECKPOINT 4.A confirmed — UI reflects new values
- [ ] CHECKPOINT 4.B confirmed — re-run reported `minted=0`

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

**STOP — operator question:** Does `git status templates/agent-roles/ --porcelain` print no output (i.e. all frontmatter edits are committed; not a list of `M` lines)?

Type `confirmed` to proceed.

## CHECKPOINT 4.B

**STOP — operator question:** Did the registration script's final line print `minted=0` (not any positive integer, not an error)?

Type `confirmed` to proceed.


## Source: paperclip/50-approval-gates.md


> Stage 5. Run after `40-routines-and-budgets.md` CHECKPOINT 4.A passes.

## Goal

Define which CortexOS roles require human approval before executing
destructive or irreversible operations, configure the Paperclip approval
gate, set timeout + escalation, and wire timeouts into the NATS alert bus.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Review threat model + gate matrix
- [ ] POST approval-policy to `$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/approval-policy`
- [ ] Confirm response 200 lists 8 gated roles
- [ ] Trigger "Test gate" from dashboard; confirm approval row appears
- [ ] Approve within 5s; confirm gate resolves
- [ ] Let a second test gate time out; confirm `cortex.alerts.warning.approval-timeout` on NATS
- [ ] Confirm Slack on-call channel receives timeout notification
- [ ] CHECKPOINT 5.A confirmed — policy POST 200 + 8 gates
- [ ] CHECKPOINT 5.B confirmed — dashboard test gate visible
- [ ] CHECKPOINT 5.C confirmed — timeout alert fires on NATS
- [ ] CHECKPOINT 5.D confirmed — Slack received timeout

## Threat model

Roles in the `git-master` class can rewrite history, force-push, and delete
branches. Roles in the `infra-master` class can `systemctl` and modify
secrets on disk. Both classes MUST require a human signature on the
Paperclip approval queue before any destructive call lands.

## Gate matrix

| CortexOS role     | Gate? | Class         | Notes                                    |
| ----------------- | ----- | ------------- | ---------------------------------------- |
| CEO               | no    | strategic     | Issues epics only; never touches infra.  |
| CTO               | yes   | infra-master  | Approves architecture + infra rollouts.  |
| PM, PO            | no    | strategic     | Read/write issues only.                  |
| STAFF-ENG         | yes   | git-master    | Force-push, history rewrite, releases.   |
| ENG-BACKEND       | yes   | git-master    | `main` merge requires gate.              |
| ENG-FRONTEND      | yes   | git-master    | `main` merge requires gate.              |
| ENG-MOBILE        | yes   | git-master    | Store submission requires gate.          |
| ENG-ESP32         | yes   | infra-master  | OTA firmware push requires gate.         |
| ENGINEER          | yes   | git-master    | Default: same as STAFF-ENG.              |
| CORTEX            | yes   | infra-master  | Host-level changes (`systemctl`, fs).    |
| QA                | no    | read-only     | Reports only.                            |
| UXUI              | no    | read-only     | Design artefacts only.                   |
| BOOK-*            | no    | read-only     | Drafts go through PM gate.               |

## Configure the gates

The Paperclip `approval` policy is configured per-agent via the board API.
The bridge writes the policy from the role frontmatter; for now, set it
once via the board CLI:

```bash
sudo -u cortex env $(sudo grep -v '^#' /opt/cortexos/.secrets/paperclip.env | xargs) \
  curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/approval-policy" \
  -H "authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "content-type: application/json" \
  -d '{
        "defaultTimeoutSeconds": 7200,
        "gates": [
          {"role": "STAFF-ENG",    "class": "git-master",   "required": true},
          {"role": "ENG-BACKEND",  "class": "git-master",   "required": true},
          {"role": "ENG-FRONTEND", "class": "git-master",   "required": true},
          {"role": "ENG-MOBILE",   "class": "git-master",   "required": true},
          {"role": "ENG-ESP32",    "class": "infra-master", "required": true},
          {"role": "ENGINEER",     "class": "git-master",   "required": true},
          {"role": "CTO",          "class": "infra-master", "required": true},
          {"role": "CORTEX",       "class": "infra-master", "required": true}
        ]
      }'
```

Default timeout: **2h (`7200` seconds)**. Approvals not granted within the
timeout are auto-cancelled; the gated operation is rejected and Paperclip
emits an `approval.timeout` event.

## Escalation

When an approval is pending for more than `defaultTimeoutSeconds / 2`
(default 1h):

1. Paperclip notifies the agent's `boss` (per frontmatter) on Slack.
2. If still pending at timeout, the request is auto-cancelled.

When an approval **times out**, the bridge publishes a NATS alert:

- Subject: `cortex.alerts.warning.approval-timeout`
- Payload: `{ approvalId, role, agentId, requestedAt, timeoutAt, action }`
- Routing: the alerts consumer fans the message out to the dashboard alerts
  panel and to the on-call Slack channel configured in
  `/opt/cortexos/.secrets/alerts.env`.

## Verify

```bash
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/approval-policy" \
  -H "authorization: Bearer $PAPERCLIP_API_KEY" | jq
```

Trigger a dry-run gate from the dashboard `Paperclip` panel ("Test gate" on
any git-master role). Observe:

- Approval row appears in the Paperclip UI.
- Approving it within 5 seconds resolves the gate.
- Letting it sit produces `cortex.alerts.warning.approval-timeout` on the
  bus (verify via `nats sub 'cortex.alerts.>'`).

## CHECKPOINT 5.A

**STOP — operator question:** Does `curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/approval-policy" -H "authorization: Bearer $PAPERCLIP_API_KEY" | jq '.gates | length'` print `8` (not `0`, not `null`)?

Type `confirmed` to proceed.

## CHECKPOINT 5.B

**STOP — operator question:** After clicking dashboard "Test gate" for a git-master role, does the Paperclip UI Approvals queue show a new row for that role within 5 seconds (not empty, not 5xx)?

Type `confirmed` to proceed.

## CHECKPOINT 5.C

**STOP — operator question:** Does `nats sub --count=1 'cortex.alerts.warning.approval-timeout' --timeout 5s` (run during a deliberate timeout) print one event (not time out, not `connection refused`)?

Type `confirmed` to proceed.

## CHECKPOINT 5.D

**STOP — operator question:** Did the on-call Slack channel referenced in `/opt/cortexos/.secrets/alerts.env` receive a new `approval-timeout` message in the same window (not silent, not API-error)?

Type `confirmed` to proceed.
