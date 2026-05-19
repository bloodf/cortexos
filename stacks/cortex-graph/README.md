# cortex-graph — LangGraph sidecar

> Resumable agent state with Postgres checkpoints. Owns the execution graph for any agent role with `graphEnabled: true` frontmatter.
>
> **Compose prerequisites.** This stack assumes the external `cortex-net` docker network exists and that NATS + Postgres are already reachable on it — bring them up via `prompts/tools/30-nats.md` + `prompts/tools/14-postgresql.md` before `docker compose up -d`.

## Overview

`cortex-graph` is a FastAPI service that wraps a [LangGraph](https://langchain-ai.github.io/langgraph/) `StateGraph` whose checkpoint state persists in Postgres. The graph topology is intentionally minimal:

```text
START -> planner -> executor -> human_review -> verifier -> END
```

`human_review` is an explicit interrupt point. Runs pause there until a human approves or rejects the proposed plan via `POST /graph/runs/:id/resume`.

`cortex-consumer` routes `cortex.paperclip.work.<role>` messages through this service when the agent role's frontmatter sets `graphEnabled: true` (and `CORTEX_GRAPH_URL` is configured in the consumer environment).

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Liveness probe; no auth. |
| `POST` | `/graph/runs` | Start a run; returns `runId` + `threadId` (paused at `human_review`). |
| `POST` | `/graph/runs/{thread_id}/resume` | Resume with `{decision: approved\|rejected, note?, override?}`. |
| `GET` | `/graph/runs/{thread_id}/state` | Inspect checkpointed state. |

All `/graph/*` endpoints require `Authorization: Bearer <CORTEX_GRAPH_API_TOKEN>`.

## NATS bridge

Subscribes to `cortex.graph.invoke.>` (signed CloudEvents envelopes) and publishes lifecycle events on `cortex.graph.state.<scope>`. Envelope contract matches the rest of CortexOS:

```text
{ "data": <CloudEvent v1.0 object>, "sig": "<hex hmac-sha256 over JCS(data)>" }
```

Disable with `CORTEX_GRAPH_NATS_ENABLED=0` (default in dev).

## Configuration

Environment variables resolve from `/opt/cortexos/.secrets/graph.env` (SOPS-decrypted at boot via `scripts/secrets-decrypt.sh`):

| Var | Purpose |
|---|---|
| `GRAPH_PORT` | HTTP port. Default `8090`. |
| `CORTEX_GRAPH_API_TOKEN` | Bearer token. Must be set; empty → 503. |
| `PG_DSN` | Postgres connection string for the checkpointer. Empty falls back to in-memory. |
| `NATS_URL` | NATS endpoint. Default `nats://127.0.0.1:4222`. |
| `CORTEX_NATS_HMAC` | HMAC secret for envelope signing/verification. |
| `CORTEX_GRAPH_NATS_ENABLED` | Set `0` to disable bridge. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional traces/metrics endpoint. |

## Development

```bash
cd stacks/cortex-graph
python -m venv .venv && source .venv/bin/activate
pip install -e .[dev]
pytest -q
```

## Docker

```bash
docker compose up --build
```

The image is multi-stage `python:3.13-slim`, runs as non-root, and uses `dumb-init` as PID 1.

## Schema

State payload (CE `data` field for `cortex.graph.state.<runId>.v1`):

```json
{
  "runId": "run_abc",
  "nodeName": "verifier",
  "status": "completed",
  "output": {},
  "error": null,
  "ts": "2026-05-18T12:00:00Z",
  "checkpoint": "ckpt_..."
}
```

`status` is one of `pending | running | completed | failed | awaiting_human`. See `schemas/cortex-graph-state-v1.json`.

## Related

- [docs/AGENT-GRAPH.md](../../docs/AGENT-GRAPH.md) — architecture deep dive.
- [docs/NATS-CONTRACT.md](../../docs/NATS-CONTRACT.md) — `cortex.graph.*` namespace.
- [prompts/tools/45-cortex-graph.md](../../prompts/tools/45-cortex-graph.md) — operator install.
