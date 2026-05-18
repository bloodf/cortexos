# CortexOS Schema Registry

JSON Schema (draft-07) registry for every CloudEvents 1.0 `data` payload published in CortexOS. The CloudEvents envelope itself lives in `cloudevents-base.json`.

## File naming

`<namespace>-<verb>-v<N>.json` (paperclip work → `paperclip-work-v1.json`).

For top-level namespaces (e.g. alerts) the convention collapses to `cortex-<namespace>-v<N>.json` (e.g. `cortex-alerts-v1.json`).

## Event `type` field

CloudEvents `type` MUST follow:

```
cortex.<namespace>.<verb>.<scope>.v<N>
```

Examples:

- `cortex.paperclip.work.eng-backend.v1`
- `cortex.paperclip.status.eng-backend.v1`
- `cortex.alerts.critical.bridge.v1`

The `<scope>` segment (role, severity, source, …) is variable; the schema is selected from `<namespace>.<verb>.v<N>`.

## Versioning

- **Add optional field** → no version bump.
- **Add required field, remove field, change type, narrow enum** → bump `v1` → `v2`. Keep `v1` file for one minor release with `"deprecated": true` at the root.
- New schema files MUST keep `$id` aligned with filename: `https://cortexos/schemas/<filename>`.

## Currently registered

| Filename | `type` pattern |
|---|---|
| `cloudevents-base.json` | (envelope, every event) |
| `paperclip-work-v1.json` | `cortex.paperclip.work.<role>.v1` |
| `paperclip-status-v1.json` | `cortex.paperclip.status.<role>.v1` |
| `paperclip-approval-v1.json` | `cortex.paperclip.approval.<role>.v1` |
| `cortex-alerts-v1.json` | `cortex.alerts.<severity>.<source>.v1` |
| `cortex-graph-state-v1.json` | `cortex.graph.state.<scope>.v1` (V7 placeholder) |
| `cortex-signal-v1.json` | `cortex.signal.<scope>.v1` (V12 placeholder) |

## Validation & CI

- Runtime validation lives in `@cortexos/events` (`packages/cortex-events`). Producers MUST build envelopes through that package; consumers MUST `parse()`/`validate()` inbound messages.
- CI enforcement: `.github/workflows/schema-check.yml` compiles every schema with `ajv` and runs `scripts/schema-version-check.js` to fail any PR that mutates a published `v<N>` schema without co-introducing `v<N+1>`.

## Deprecation

When superseding `<x>-v1.json` with `<x>-v2.json`:

1. Add `<x>-v2.json` with the new contract.
2. Add `"deprecated": true` to `<x>-v1.json`.
3. Update producers/consumers to dual-emit / dual-accept for one minor release.
4. Remove the deprecated file in the next minor release.
