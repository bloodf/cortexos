# @cortexos/telemetry

Node OpenLLMetry + Langfuse wrapper for CortexOS services.

- Single `instrument({ service, env })` call at boot.
- `traceLLMCall({ name, model, input, ... }, async () => { ... })` wraps any
  LLM invocation with a Langfuse generation span (input, output, usage,
  latency, errors).
- **Safe no-op** when `LANGFUSE_HOST` is unset (dev/test) or
  `CORTEX_TELEMETRY_DISABLED=1`.

## Usage

```js
import { instrument, traceLLMCall, shutdown } from "@cortexos/telemetry";

instrument({ service: "cortex-consumer", env: process.env.CORTEX_ENV });

const result = await traceLLMCall(
  {
    name: "openclaw.dispatch",
    model: "openclaw-cli",
    input: { subject, payload },
    metadata: { runId: data.runId, role },
  },
  () => openclawExec(args),
);

process.on("SIGTERM", () => shutdown());
```

## Environment

| Var | Required | Description |
| --- | --- | --- |
| `LANGFUSE_HOST` | yes (for tracing) | Base URL of self-hosted Langfuse |
| `LANGFUSE_PUBLIC_KEY` | yes (for tracing) | Project public key (`pk-lf-…`) |
| `LANGFUSE_SECRET_KEY` | yes (for tracing) | Project secret key (`sk-lf-…`) |
| `CORTEX_TELEMETRY_SERVICE` | no | Defaults to `cortexos` |
| `CORTEX_TELEMETRY_ENV` | no | Defaults to `NODE_ENV` or `production` |
| `CORTEX_TELEMETRY_DISABLED` | no | `1` to force-disable even with creds set |

## Testing

```bash
pnpm install
pnpm test
```

Tests cover the no-op path; live Langfuse integration is exercised in the
smoke prompt (`prompts/tools/55-langfuse.md`).
