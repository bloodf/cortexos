# Paperclip ↔ CortexOS — Approval Gates

> Stage 5. Run after `40-routines-and-budgets.md` CHECKPOINT 4.A passes.

## Goal

Define which CortexOS roles require human approval before executing
destructive or irreversible operations, configure the Paperclip approval
gate, set timeout + escalation, and wire timeouts into the NATS alert bus.


## Todo

- [ ] Threat model
- [ ] Gate matrix
- [ ] Configure the gates
- [ ] Escalation
- [ ] Verify
- [ ] CHECKPOINT 5.A confirmed
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

**STOP — operator question:** Verify this checkpoint's preconditions are met?

- [ ] Approval policy POST returns `200` and lists all 8 gated roles.
- [ ] Dashboard "Test gate" produces a visible Paperclip approval row.
- [ ] Timeout fires `cortex.alerts.warning.approval-timeout` on NATS.
- [ ] On-call Slack channel receives the timeout notification.

Type `confirmed` to proceed.
