# CortexOS NATS Contract

> Event subject taxonomy, payload schemas, routing rules, and compatibility policy for CortexOS orchestration.

## Contents

- [Subject format](#subject-format)
- [Domains](#domains)
- [Payload envelope](#payload-envelope)
- [Examples](#examples)
- [Compatibility](#compatibility)
- [Security](#security)
- [Related docs](#related-docs)

## Subject format

```text
cortex.<domain>.<scope>.<verb>
```

| Segment | Meaning | Example |
|---|---|---|
| `domain` | Event category | `ci`, `repo`, `agent`, `human`, `infra` |
| `scope` | Repo, service, or `_` | `dashboard`, `cortexos`, `nats` |
| `verb` | Event or command | `passed`, `failed`, `review`, `assigned` |

Never publish to wildcard subjects. Wildcards are subscriber filters only.

## Domains

| Domain | Purpose |
|---|---|
| `ci` | Build, lint, test, release events |
| `repo` | Review, issue, pull request, merge events |
| `agent` | Assignment, progress, completion, failure |
| `human` | Owner approval or message events |
| `infra` | Service health, deployment, restart, alert events |

## Payload envelope

```json
{
  "version": 1,
  "id": "evt_01HX...",
  "ts": "2026-05-16T00:00:00Z",
  "source": "husky",
  "repo": "cortexos",
  "result": "passed",
  "summary": "dashboard tests passed",
  "links": []
}
```

Required fields: `version`, `ts`, `source`. Domain-specific fields must be documented beside producer and consumer changes.

## Examples

```text
cortex.ci.cortexos.passed
cortex.ci.cortexos.failed
cortex.repo.dashboard.review
cortex.agent.pm.assigned
cortex.human.owner.message
cortex.infra.nats.unhealthy
```

## Compatibility

- Additive fields are backward compatible.
- Removing or renaming fields requires version bump.
- Consumers must ignore unknown fields.
- Producers should include enough context for Slack rendering without extra lookups.

## Security

Approval and privileged-operation payloads require HMAC verification. Failed verification routes to dead-letter handling and must not trigger action.

## Paperclip subjects

> Reserved namespace for the Paperclip ↔ CortexOS bridge (P2). All payloads use
> the HMAC envelope shape `{ data: <payload>, sig: <sha256-hex> }` where `sig`
> is `HMAC-SHA256(CORTEX_NATS_HMAC, JCS(data))`.

### `cortex.paperclip.work.<role>`

- **Direction**: bridge → consumer.
- **Producer**: `stacks/cortex-paperclip-bridge` after a Paperclip heartbeat.
- **Consumer**: `cortex-consumer` durable `cortex-consumer-paperclip-work`.
- **`<role>`**: CortexOS role enum (`ENG-BACKEND`, `ENG-FRONTEND`, `SECURITY`, `OPS`, ...).
- **`data` shape**:

  ```json
  {
    "runId": "string",
    "agentId": "string",
    "issueId": "string",
    "wakeReason": "scheduled|comment|new_issue|manual",
    "commentId": "string|null",
    "role": "ENG-BACKEND",
    "payload": { "...": "merged Paperclip payloadTemplate fields" },
    "ts": "RFC3339",
    "replay": false
  }
  ```

### `cortex.paperclip.status.<role>`

- **Direction**: consumer → bridge.
- **Producer**: `cortex-consumer` once an executor pipeline reaches a terminal
  state (`done|failed|cancelled`) or an intermediate `in_progress` heartbeat.
- **Consumer**: `cortex-paperclip-bridge` durable `cortex-paperclip-bridge-status`.
- **`data` shape**:

  ```json
  {
    "runId": "string",
    "issueId": "string",
    "status": "in_progress|done|failed|cancelled",
    "comment": "string",
    "costUsdCents": 0
  }
  ```

### `cortex.paperclip.approval.<role>` (reserved)

Reserved for P3 governance gate. Producers must not publish to this subject
until the approval workflow lands.

## Operational alerts

> Reserved namespace for dashboard → Paperclip alerts plugin (P8). Same HMAC
> envelope shape `{ data, sig }` as the Paperclip subjects above.

### `cortex.alerts.<severity>.<source>`

- **Direction**: dashboard → bridge → Paperclip.
- **Producer**: `dashboard/src/lib/alerts.ts` (`publishAlert`).
- **Consumer**: `stacks/cortex-paperclip-bridge/alerts.js` durable
  `cortex-paperclip-bridge-alerts`, filter `cortex.alerts.>`.
- **`<severity>`**: one of `info`, `warning`, `critical`. Bridge gates by
  `BRIDGE_ALERTS_MIN_SEVERITY` (default `warning`).
- **`<source>`**: opaque identifier, ASCII `[A-Za-z0-9._-]+` (e.g. `cpu`,
  `bridge`, `dashboard.api`). Used as the rate-limit bucket key
  (max 10 events / source / minute).
- **`data` shape**:

  ```json
  {
    "title": "string (required)",
    "body": "string",
    "severity": "info|warning|critical",
    "source": "string",
    "timestamp": "RFC3339",
    "metadata": { "...": "optional structured context" }
  }
  ```

- **Delivery**:
  - Default: `POST /api/notifications` on Paperclip with the data fields above.
  - Fallback (notifications endpoint 404 + `BRIDGE_ALERTS_OPS_ISSUE_ID` set):
    comment on the configured ops issue with label `priority:high`.
  - Digest mode (`BRIDGE_ALERTS_DIGEST=1`): `info` alerts buffered for 5 minutes
    then posted as a single summary notification with `source=bridge-digest`.

- **Kill switch**: bridge env `BRIDGE_ALERTS_ENABLED=0` skips the subscription.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
