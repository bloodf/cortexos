# CortexOS A2A Protocol

> Agent-to-agent communication conventions for handoffs, review, escalation, and shared context.

## Contents

- [Purpose](#purpose)
- [Message types](#message-types)
- [Handoff format](#handoff-format)
- [Review format](#review-format)
- [Rules](#rules)
- [Related docs](#related-docs)

## Purpose

A2A messages keep multi-agent work auditable and deterministic. Agents should communicate through documented channels, not hidden side effects.

## Message types

| Type | Purpose |
|---|---|
| `handoff` | Transfer work with state and next steps |
| `review-request` | Ask reviewer role to inspect output |
| `blocker` | Escalate missing input or unsafe condition |
| `decision` | Record accepted tradeoff |
| `completion` | Mark terminal result with evidence |

## Handoff format

```json
{
  "type": "handoff",
  "from": "PM",
  "to": "STAFF-ENG",
  "scope": "dashboard credentials flow",
  "done": ["requirements clarified"],
  "next": ["implement tests", "update docs"],
  "risks": ["avoid leaking secrets in logs"],
  "links": []
}
```

## Review format

Review messages must include finding severity, evidence, impact, and suggested fix. Blocking findings require exact reproduction or code path.

## Rules

- Keep messages concise and actionable.
- Include file paths and commands exactly.
- Do not pass secrets through A2A messages.
- Escalate uncertainty instead of fabricating state.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
