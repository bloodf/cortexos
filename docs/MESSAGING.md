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

### OpenClaw delivery is CLI-shellout (resolved 2026-05-19)

The OpenClaw gateway at `127.0.0.1:18789` exposes only `/health` over
HTTP; all delivery RPC is WebSocket. Legacy `/sendMessage` /
`/registerRoute` HTTP routes never existed upstream. CortexOS picked
option #2 from the prior operator-decision matrix: `consumer.js`
delivers via the `openclaw` CLI (`openclaw message send --json`,
`openclaw agents bind`), which is the verified real-OpenClaw surface.

Toggle the experimental REST path with
`OPENCLAW_DELIVERY_API_VERSION=v1` to route through
`POST ${OPENCLAW_BASE}/v1/channels/<channel>/messages` with bearer
`OPENCLAW_API_KEY`. Default remains `cli`. The HTTP path is opt-in
until upstream publishes a stable REST surface — see TODO marker in
`stacks/cortex-consumer/consumer.js`.

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
