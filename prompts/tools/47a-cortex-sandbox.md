# 47a - Cortex Sandbox Runner

The sandbox runner remains a host AI harness tool during the rebuild.

Source:

- `stacks/cortex-sandbox-runner`

Validation:

```bash
curl -fsS http://127.0.0.1:8091/healthz
```

Project agents should normally execute inside Incus instances; use the sandbox
runner only for explicitly granted host tool execution.
