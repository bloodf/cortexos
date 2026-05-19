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

### OpenClaw delivery paths

`consumer.js` implements both supported OpenClaw delivery paths:

- Default `cli`: shells out to `openclaw message send --json`, which remains the
  verified gateway-compatible path for native installs.
- Opt-in `v1`: set `OPENCLAW_DELIVERY_API_VERSION=v1` and `OPENCLAW_API_KEY` to
  deliver with `POST ${OPENCLAW_BASE}/v1/channels/<channel>/messages`.

Legacy `/sendMessage` and `/registerRoute` HTTP routes never existed upstream and
are not used. Operators choose the HTTP v1 path explicitly through the env var;
otherwise the consumer keeps the CLI default.

### Slack channel setup

Slack channel setup uses the installed OpenClaw CLI channel surface in
`41-openclaw-channels.md`. Do not install stale standalone packages such as
`@openclaw/slack`; they are not part of the CortexOS install contract
to fully suppress Slack delivery.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
