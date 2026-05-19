# Paperclip ↔ CortexOS — Approval Gates

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
