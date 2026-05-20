# Agent Graph — `cortex-graph` LangGraph Sidecar

> V7 execution engine. Owns resumable agent state with Postgres
> checkpoints. Sits between `cortex-consumer` and the executor pipeline
> for any role whose template frontmatter declares `graphEnabled: true`.

## Contents

- [Why](#why)
- [Topology](#topology)
- [Node contracts](#node-contracts)
- [Checkpoint lifecycle](#checkpoint-lifecycle)
- [Resume semantics](#resume-semantics)
- [NATS surface](#nats-surface)
- [Trust model](#trust-model)
- [Operational runbook](#operational-runbook)
- [Related docs](#related-docs)

## Why

The pre-V7 consumer dispatched each role's work message directly to the
executor. State lived in process memory: a crash mid-run lost
everything. V7 introduces a LangGraph `StateGraph` whose checkpoints
persist in Postgres so any node transition survives:

- restarts of `cortex-graph`,
- restarts of `cortex-consumer`,
- the human-in-the-loop pause at `human_review`.

The sidecar is intentionally stateless from the caller's perspective —
every HTTP / NATS request is re-evaluated against the checkpointer
keyed by `thread_id`.

## Topology

```text
START → planner → executor → human_review → verifier → END
                              ^                ^
                              |                |
                  interrupt_before          decision = approved|rejected
```

`human_review` is configured via `interrupt_before`. The graph pauses
before that node executes. Operator (or another agent) drives the
resume via `POST /graph/runs/:thread_id/resume`.

## Node contracts

Every node is `async def run(state: RunState) -> RunState`. The state
TypedDict is shared across nodes (see `stacks/cortex-graph/app/graph.py`).
Each node returns a **new** state dict — never mutates in place.

### planner

- **Input**: `state.role`, `state.input` (opaque payload).
- **Output**: `state.plan` = list of `{step, role, ...}` dicts, plus
  `state.phase = "planned"`.
- **Failure mode**: raises on empty role; no I/O.

### executor

- **Input**: `state.plan`.
- **Output**: `state.results` (one per step), `state.phase = "executed"`.
- Each result includes `status` (`ok` | `err`). The executor itself
  never decides verification — that is the verifier's job.

### human_review

- **Input**: `state.human_decision` populated by the resume call.
- **Output**: `state.phase = "approved" | "rejected"`. Rejection short-
  circuits the verifier (it will mark `verified: False`).
- **Pause point**: graph interrupts **before** this node so the
  checkpointer already captures `phase = "executed"` when control
  returns to the operator.

### verifier

- **Input**: `state.results`, `state.phase` (post-human_review).
- **Output**: `state.verified` (bool), `state.phase = "verified" | "failed"`,
  `state.failures` (list of failing step ids, if any).

## Checkpoint lifecycle

The compiled graph binds to one of two checkpointers, chosen by
`PG_DSN` at boot:

| Setting | Checkpointer | Use case |
|---|---|---|
| `PG_DSN=""` | `langgraph.checkpoint.memory.MemorySaver` | Unit tests, ephemeral dev. |
| `PG_DSN=<dsn>` | `langgraph.checkpoint.postgres.aio.AsyncPostgresSaver` | Production. |

Production tables are provisioned by `packages/cortex-dashboard/migrations/007_langgraph_checkpoints.sql`
(re-created by `AsyncPostgresSaver.setup()` if missing, but Git is the
source of truth):

- `checkpoints` — one row per durable graph checkpoint.
- `checkpoint_blobs` — channel-versioned state slices.
- `checkpoint_writes` — pending writes within a step.
- `checkpoint_migrations` — version bookkeeping owned by LangGraph.

Each checkpoint key is `(thread_id, checkpoint_ns, checkpoint_id)`.
`thread_id` is the orchestrator-issued identifier returned by
`POST /graph/runs`. Restart safety: re-invoking with the same
`thread_id` resumes from the latest checkpoint instead of starting a
new run.

## Resume semantics

1. `POST /graph/runs` returns `status=interrupted, nodeId=human_review`
   when the graph hits the pause.
2. Operator inspects state: `GET /graph/runs/{thread_id}/state`.
3. Operator releases the run: `POST /graph/runs/{thread_id}/resume`
   with `{decision: "approved" | "rejected", note?, override?}`.
4. The orchestrator writes `human_decision` to the checkpointed state
   via `aupdate_state`, then re-invokes the graph with `None` input —
   LangGraph picks up at the paused node.
5. The verifier runs, the final checkpoint is committed, and
   `RunResponse.status` is `completed` or `failed`.

Idempotency: resuming an already-completed thread is a no-op (the next
node is `END`); the orchestrator returns the latest snapshot.

## NATS surface

The bridge (`app/nats_bridge.py`) is optional (`CORTEX_GRAPH_NATS_ENABLED`).
When on:

- **Subscribes**: `cortex.graph.invoke.>` — HMAC-signed CloudEvents
  envelopes whose inner `data` matches `RunRequest`.
- **Publishes**: `cortex.graph.state.<runId>` — lifecycle events whose
  inner `data` matches `schemas/cortex-graph-state-v1.json`. Status
  values: `pending | running | completed | failed | awaiting_human`.

Envelope format matches the V2 paperclip contract exactly:

```json
{ "data": <CloudEvent v1.0>, "sig": "<hex hmac-sha256 over JCS(data)>" }
```

See [NATS-CONTRACT.md](NATS-CONTRACT.md#cortexgraph-namespace) for the
full taxonomy and producer/consumer obligations.

## Trust model

| Area | Boundary | Control |
|---|---|---|
| HTTP API | `127.0.0.1:8090` bound only | Tailscale Serve publishes `:8090` when external tailnet access is required |
| Bearer | `CORTEX_GRAPH_API_TOKEN` | `hmac.compare_digest` comparison; empty token = service refuses every request |
| NATS envelope | `CORTEX_NATS_HMAC` | HMAC-SHA256 over JCS canonical bytes; constant-time verification |
| Checkpoint DB | `dashboard` role on `cortex_dashboard` | Same blast radius as the dashboard service |

## Operational runbook

| Symptom | Probable cause | Action |
|---|---|---|
| `/healthz` 503 | App initialized but checkpointer connect failed | Check `PG_DSN`, confirm migration 007 applied |
| 401 on every `/graph/*` | `CORTEX_GRAPH_API_TOKEN` empty | Decrypt `graph.env`, restart container |
| `cortex.graph.state.*` silent | `CORTEX_GRAPH_NATS_ENABLED=0` or HMAC missing | Verify env on the container, restart |
| Runs stuck at `awaiting_human` | No resume call after pause | Operator approves via API or dashboard |
| Postgres bloat | Long-running threads accumulating checkpoints | TBD — V7.1 will add a retention sweeper |

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [NATS contract](NATS-CONTRACT.md)
- [Secrets](SECRETS.md)
- [`stacks/cortex-graph/README.md`](../stacks/cortex-graph/README.md)
- [`prompts/tools/45a-cortex-graph.md`](../prompts/tools/45a-cortex-graph.md)
