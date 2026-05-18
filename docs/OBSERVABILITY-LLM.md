# OBSERVABILITY-LLM

> LLM-call observability across CortexOS using self-hosted Langfuse v3 +
> ClickHouse + OpenLLMetry (Traceloop SDK).

## Goal

Every LLM-driven decision in CortexOS — OpenClaw dispatch, cortex-graph
LangGraph runs, paperclip bridge webhook fan-out — emits a trace + spans
to Langfuse with:

- prompt / input
- model identifier
- output / completion
- token usage (input, output, total)
- latency
- error status + message

Operators get a single timeline view across the three services without
sprinkling `console.log` calls. Existing Prometheus metrics on
`cortex-consumer` remain authoritative for queue depth + circuit state;
Langfuse is the **per-call** introspection plane.

## Stack

| Component | Image | Role |
| --- | --- | --- |
| `langfuse-web` | `langfuse/langfuse:3` | UI + ingest API on port 3000 |
| `langfuse-worker` | `langfuse/langfuse-worker:3` | Async event pipeline |
| `clickhouse` | `clickhouse/clickhouse-server:24.12-alpine` | Trace event store |
| `minio` | `minio/minio:RELEASE.2025-01-20T14-49-07Z` | Blob store for large event bodies |
| Postgres | reused from core stack | Metadata (orgs, projects, users) |

Stack file: `stacks/cortex-langfuse/docker-compose.yml`.

> Note: MinIO here is an **internal** compose service for Langfuse blob
> storage. The Railway-only-for-external-buckets rule is unaffected.

## SDKs

| Language | Wrapper | Underlying |
| --- | --- | --- |
| Node ≥ 22 | `@cortexos/telemetry` | `@traceloop/node-server-sdk` + `langfuse` |
| Python ≥ 3.13 | `app.telemetry` (in `stacks/cortex-graph/`) | `traceloop-sdk` |

Both wrappers expose:

- `instrument(service, env)` — idempotent boot init, safe no-op when
  `LANGFUSE_HOST` is unset or `CORTEX_TELEMETRY_DISABLED=1`.
- (Node only) `traceLLMCall(spec, handler)` — wraps an async LLM call with
  a Langfuse generation span.

## Wiring

### cortex-consumer (Node)

```js
import { instrument as instrumentTelemetry, traceLLMCall, shutdown as shutdownTelemetry } from "@cortexos/telemetry";

instrumentTelemetry({ service: "cortex-consumer" });

await traceLLMCall(
  { name: "openclaw.message.send", model: "openclaw-cli", input: { args } },
  () => execFileP(OPENCLAW_BIN, args, { ... }),
);
```

Dispatch through `openclawExec()` is already wrapped — every CLI invocation
yields one Langfuse generation span tagged `openclaw, dispatch`.

### cortex-paperclip-bridge (Node)

```js
import { instrument as instrumentTelemetry, shutdown as shutdownTelemetry } from "@cortexos/telemetry";
instrumentTelemetry({ service: "cortex-paperclip-bridge" });
```

The bridge produces inbound HTTP spans via OpenLLMetry's express
auto-instrumentation; explicit `traceLLMCall` is not needed because the
bridge itself never issues LLM calls.

### cortex-graph (Python)

```python
from app.telemetry import instrument as instrument_telemetry
instrument_telemetry(service="cortex-graph")
```

LangGraph nodes are auto-instrumented by `traceloop-sdk` — each invoke
becomes a child span under the inbound `POST /graph/runs` trace.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `LANGFUSE_HOST` | yes | Self-host base URL (e.g. `http://langfuse-web:3000`) |
| `LANGFUSE_PUBLIC_KEY` | yes | Project public key (`pk-lf-…`) |
| `LANGFUSE_SECRET_KEY` | yes | Project secret key (`sk-lf-…`) |
| `CORTEX_TELEMETRY_SERVICE` | no | Override service name (default per service) |
| `CORTEX_TELEMETRY_ENV` | no | `dev`/`staging`/`production` (defaults to `NODE_ENV` / `APP_ENV`) |
| `CORTEX_TELEMETRY_DISABLED` | no | Set to `1` to force-disable |

Provisioned through SOPS: `templates/.secrets/langfuse.enc.yaml`.

## Dev / test mode

`LANGFUSE_HOST` unset → `instrument()` is a no-op, `traceLLMCall` calls the
handler directly with zero overhead. Existing unit/integration suites
(`packages/cortex-events/`, `stacks/cortex-consumer/__tests__`,
`stacks/cortex-paperclip-bridge/__tests__`) remain green without
modification.

## Operator runbook

- Install: `prompts/tools/55-langfuse.md`.
- Rollback: stop the stack with `docker compose down`. Volumes
  (`clickhouse-data`, `clickhouse-logs`, `minio-data`) retain history;
  drop only on full tenant teardown.
- Key rotation: regenerate `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`
  in the Langfuse UI (Project Settings → API Keys), re-encrypt
  `templates/.secrets/langfuse.enc.yaml`, redeploy the three services.
- Storage growth: ClickHouse is by far the dominant volume — monitor
  `clickhouse-data`. Apply TTL on `traces` and `observations` tables once
  retention requirements are agreed.

## Related

- `docs/OBSERVABILITY.md` — Prometheus + Loki + Grafana plane.
- `stacks/cortex-langfuse/README.md` — stack-level README.
- `packages/cortex-telemetry/README.md` — Node SDK reference.
