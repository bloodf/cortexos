# cortex-agentgateway

Vendored, minimal AgentGateway implementation for CortexOS. Enforces the tool
taxonomy defined in `config/tools.json` (mirror of
`templates/agentgateway/tools.json`): per-role allow-lists, confirmation tokens
for destructive-class tools, and CloudEvents-wrapped audit emission to NATS.

This stack replaces the external `agentgateway/agentgateway` clone that
`prompts/tools/50-agentgateway.md` previously fetched. Source of truth lives in
this repo so installs are reproducible and audit subjects are pinned.

## Run (local)

```bash
docker network create cortex-net 2>/dev/null || true
cd stacks/cortex-agentgateway
docker compose up -d --build
curl -fsS http://127.0.0.1:18800/health
```

## Endpoints

| Method | Path             | Auth   | Purpose                                     |
| ------ | ---------------- | ------ | ------------------------------------------- |
| GET    | `/health`        | none   | Liveness + policy version.                  |
| GET    | `/tools`         | Bearer | Registered tools (name, class, description).|
| POST   | `/tool/invoke`   | Bearer | Invoke a tool. Body: `{tool, args, runId, agentId, role, confirmationToken?}`. |

Bearer header: `Authorization: Bearer ${AGENTGATEWAY_BEARER_TOKEN}`.

## Environment contract

Mounted from `/opt/cortexos/.secrets/agentgateway.env` (mode `0600`):

| Var                          | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `AGENTGATEWAY_PORT`          | Listen port (default `18800`).                   |
| `AGENTGATEWAY_BEARER_TOKEN`  | Shared secret for inbound auth.                  |
| `AGENTGATEWAY_CONFIG`        | Optional override for tools.json path.           |
| `NATS_URL`                   | NATS endpoint (default `nats://127.0.0.1:4222`). |
| `CORTEX_NATS_HMAC`           | HMAC secret for the `{data, sig}` envelope.      |
| `DATABASE_URL`               | Postgres URL for `@cortexos/audit` chain append. |
| `CORTEX_AUDIT_ENABLED`       | Set `0` to skip Postgres audit appends.          |
| `LANGFUSE_HOST`              | Optional — enables `@cortexos/telemetry`.        |

## NATS contract

Audit publish: subject **`cortex.audit.agentgateway.tool-invoke.v1`**.
Payload is a CloudEvents 1.0 envelope (`@cortexos/events.envelope()`) wrapped
in the standard CortexOS `{ data, sig }` HMAC envelope.
`Nats-Msg-Id` is stamped with the CloudEvents `id` for JetStream dedup.

Schema URL pointer (placeholder): `schemas/cortex-audit-agentgateway-v1.json`.

## Auth model

- All mutating / introspective endpoints require a static bearer token.
- Tool class enforcement happens inside `/tool/invoke`:
  - `safe` — allowed if the role's `safe` list is `"*"` or contains the tool.
  - `privileged` — allowed if the role's `privileged` list contains the tool.
  - `destructive` — allowed if the role's `destructive` list contains the
    tool **and** the request includes a non-empty `confirmationToken`.
- Unknown tool or unknown role → `403`.

## Tool taxonomy

See `config/tools.json`. It is a verbatim copy of
`templates/agentgateway/tools.json` and is updated in lockstep with that file.

## Tests

```bash
cd stacks/cortex-agentgateway
npm install
npm test
```

The Vitest suite covers `/health` (no auth), missing bearer (`401`),
non-destructive happy path (`200`), and destructive-without-token (`403`).
