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

## Envelope (v2)

Starting with V2, **every** NATS publish, inbound webhook payload, and audit row body
is wrapped in a **CloudEvents 1.0 envelope** before the existing HMAC envelope
(`{ data, sig }`). On the wire the layering is therefore:

```
{ data: <CloudEvent>, sig: <hex hmac over JCS(<CloudEvent>)> }
```

### CloudEvents fields (required)

| Field            | Description                                                                  |
|------------------|------------------------------------------------------------------------------|
| `specversion`    | const `"1.0"`                                                                |
| `id`             | UUID v4 per event                                                            |
| `type`           | `cortex.<namespace>.<verb>.<scope>.v<N>` (e.g. `cortex.paperclip.work.eng-backend.v1`) |
| `source`         | producer identifier (`cortex-paperclip-bridge`, `cortex-consumer`, …)        |
| `time`           | RFC 3339 / ISO 8601 UTC timestamp                                            |
| `datacontenttype`| const `"application/json"`                                                   |
| `data`           | namespace-specific JSON payload — validated against `schemas/<file>.json`    |

Optional: `subject`, `dataschema`, `traceparent`. CloudEvents extension attributes are allowed at top level (e.g. `replay: true` on `cortex.paperclip.work.*`).

### Schema URL convention

`dataschema` is set automatically: `https://cortexos/schemas/<namespace>-<verb>-v<N>.json`.
The registry lives under `schemas/` (see `schemas/README.md`).

### Producer / consumer obligations

- **Producers** MUST build events via `@cortexos/events.envelope()` and call `validate()` before publishing.
- **Consumers** MUST `parse()` (or `validate()`) every inbound message. Validation failures are fatal under strict mode, see flag below.

### Grace-period flag: `CORTEX_REQUIRE_ENVELOPE`

| Value         | Behavior                                                                |
|---------------|-------------------------------------------------------------------------|
| `0` (default) | Accept legacy (pre-v2) raw payloads; log a warning; continue.           |
| `1`           | Reject anything that is not a valid CloudEvents 1.0 envelope.            |

The flag is read by `stacks/cortex-paperclip-bridge/worker.js` and `stacks/cortex-consumer/consumer.js`. Set `1` once all producers in your environment have rolled to v2.

### Validation behavior

- Base envelope is validated against `schemas/cloudevents-base.json`.
- `data` is validated against the schema selected by `type`: `<namespace>-<verb>-v<N>.json` (or `cortex-<top>-v<N>.json` for collapsed top-level namespaces like `alerts`, `graph`, `signal`).
- On failure, producers throw `EnvelopeValidationError` (with `.errors` array). Consumers either throw (strict) or log + continue (grace).

## JetStream hardening (V3)

### Streams

| Stream | Subjects | Retention | Dedup window | Max age |
|---|---|---|---|---|
| `CORTEX_PAPERCLIP_WORK` | `cortex.paperclip.work.>` | `workqueue` | 120s | 24h |
| `CORTEX_PAPERCLIP_OPS` | `cortex.paperclip.status.>`, `cortex.paperclip.approval.>`, `cortex.alerts.>` | `limits` | 120s | — |
| `CORTEX_DLQ` | `cortex.dlq.>` | `limits` | 120s | 7d |
| `CORTEX` (legacy) | `cortex.factory.>`, `openclaw.>` | `limits` | server default | — |

WorkQueue retention on `CORTEX_PAPERCLIP_WORK` guarantees single-consumer dispatch semantics: a delivered message is removed from the stream once acked, so two parallel durables on the same filter cannot both process the same event.

### Dedup: `Nats-Msg-Id`

Every JetStream publish stamps `Nats-Msg-Id: <CloudEvents.id>`. The server collapses duplicate publishes within the stream's `duplicate_window` (2 minutes). Producers wired:

- `stacks/cortex-paperclip-bridge/lib/nats-publisher.js` — outbound work + alerts publishes.
- `stacks/cortex-consumer/consumer.js` — status echoes, heartbeats, accepted events.

DLQ records use a fresh uuid per terminal failure (one record per genuine failure, never collapsed).

### Dead-letter queue: `cortex.dlq.<original-subject>`

After `max_deliver` is exhausted on the originating durable, `cortex-consumer` publishes a CloudEvents-wrapped failure record to `cortex.dlq.<original-subject>` and acks the source message so JetStream stops redelivery.

DLQ schema: `schemas/cortex-dlq-v1.json`.

`data` shape:

```json
{
  "originalSubject": "cortex.paperclip.work.ENG-BACKEND",
  "originalEvent":   { "specversion": "1.0", "...": "..." },
  "errorChain":      [{ "ts": "RFC3339", "message": "...", "code": "?" }],
  "attempts":        5,
  "terminalAt":      "RFC3339"
}
```

### Backpressure

Paperclip work durable (`cortex-consumer-paperclip-work`) on `CORTEX_PAPERCLIP_WORK`:

- `max_deliver = 5`
- `max_ack_pending = 32`
- `ack_wait = 60s`
- exponential backoff: 1s, 5s, 15s, 30s, 60s

`max_ack_pending=32` caps inflight executor budget — JetStream stops dispatching new work once 32 messages are unacked, preventing executor overload during a slowdown.

## `cortex.graph.*` namespace (V7)

> Reserved namespace for the `cortex-graph` LangGraph sidecar. Same V2
> envelope shape — CloudEvents 1.0 wrapped in `{ data, sig }` with
> `sig = HMAC-SHA256(CORTEX_NATS_HMAC, JCS(data))`.

### `cortex.graph.invoke.<role>`

- **Direction**: consumer → sidecar (NATS bridge, optional path).
- **Producer**: `cortex-consumer` when the role has
  `graphEnabled: true` AND `CORTEX_GRAPH_NATS_ENABLED=1` is set on the
  consumer host. Default V7 path is HTTP (`POST /graph/runs`) so most
  deployments will not see this subject.
- **`data` shape** (CE inner data):

  ```json
  {
    "role": "PM",
    "issueId": "string",
    "runId": "string",
    "input": { "...": "opaque role payload" }
  }
  ```

### `cortex.graph.state.<runId>`

- **Direction**: sidecar → bus.
- **Producer**: `cortex-graph` after every node lifecycle transition.
- **Consumer**: dashboard run-viewer, observability stack.
- **Subject**: parameterized by `runId` so subscribers can filter to a
  single run. Schema: `schemas/cortex-graph-state-v1.json`.
- **`data` shape** (CE inner data):

  ```json
  {
    "runId": "string",
    "nodeName": "planner|executor|human_review|verifier",
    "status": "pending|running|completed|failed|awaiting_human",
    "output": { "...": "node output or empty object" },
    "error": null,
    "ts": "RFC3339",
    "checkpoint": "ckpt_..."
  }
  ```

- **Awaiting human**: `status=awaiting_human` is published when the
  graph interrupts before `human_review`. Operators resume via
  `POST /graph/runs/{thread_id}/resume`. See
  [AGENT-GRAPH.md](AGENT-GRAPH.md#resume-semantics).

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Agent Graph](AGENT-GRAPH.md)
- [Security](SECURITY.md)
- [Schema registry](../schemas/README.md)
