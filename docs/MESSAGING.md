# CortexOS Messaging

> Slack, Telegram, and dashboard notification conventions for operational clarity.

## Contents

- [Channels](#channels)
- [Message anatomy](#message-anatomy)
- [Rendering examples](#rendering-examples)
- [Severity levels](#severity-levels)
- [Related docs](#related-docs)

## Channels

| Channel | Purpose |
|---|---|
| Slack thread | Primary operational narrative and agent handoff |
| Telegram | Urgent owner fallback and approvals |
| Dashboard | Structured state, audit, and admin actions |
| NATS | Machine-readable event transport |

## Message anatomy

```text
[status] component action
Summary: one sentence outcome
Context: repo/service, branch, actor, correlation id
Next: required operator or agent action
Links: logs, PR, dashboard route
```

## Rendering examples

```text
✅ dashboard build passed
Summary: lint, tests, and Next.js build completed.
Context: repo=cortexos branch=main sha=abc123
Next: no action required.
```

```text
⚠️ credential reveal requested
Summary: admin requested masked secret reveal.
Context: slug=9router actor=admin correlation=req_123
Next: approve in dashboard if expected.
```

## Severity levels

| Level | Use |
|---|---|
| Info | Normal progress and completion |
| Warning | Degraded state or human attention needed |
| Critical | Security, data loss, outage, or unsafe action |

## Known Limitations

### Phase H FAIL — OpenClaw gateway `/sendMessage` 404 (operator decision pending)

As of OpenClaw `2026.5.12`, the gateway running on `127.0.0.1:18789` does
**not** implement the legacy HTTP endpoints `/sendMessage` or
`/registerRoute`. Every outbound delivery routed through
`stacks/cortex-consumer/consumer.js` therefore returns HTTP 404 and no
message reaches Telegram, Slack, Discord, or WhatsApp end-points — even
though the upstream NATS publish, schema validation, KV dedup, and
consumer dispatch succeed.

Live evidence (2026-05-16 Phase H final run): smoke-test publishes to
`cortex.factory.workflow.<slug>.weekly-smoke` for `3guns`, `mementry`,
`celebrar`, `netbook` all reached the consumer; consumer POSTed to
`http://127.0.0.1:18789/sendMessage` and received `404 Not Found` for
every attempt.

Operator must select one path before v1.0 sign-off:

1. **Adapter sidecar.** Build a small translator service that exposes
   `/sendMessage` and forwards to the actual OpenClaw RPC surface.
2. **Migrate consumer.** Rewrite `consumer.js` outbound calls to use
   the OpenClaw RPC client directly.
3. **Patch dashboard re-route.** Add the legacy routes inside the
   dashboard's request-translation layer.

Until resolved, treat Telegram / Slack / Discord / WhatsApp delivery as
**INERT-BY-DESIGN**. Repo prompts (`60-cortex-consumer.md`,
`40-openclaw.md`, `41-openclaw-channels.md`) mirror this caveat.

### `@openclaw/slack` plugin not bundled

The Slack channel requires the upstream `@openclaw/slack` plugin
(`npm install -g @openclaw/slack@latest`). It is NOT carried in the
base OpenClaw distribution and must be installed explicitly during
`41-openclaw-channels.md`. Live VPS verification on 2026-05-16
showed the plugin missing, which compounded the `/sendMessage` 404
to fully suppress Slack delivery.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
