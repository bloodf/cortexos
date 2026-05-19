# @cortexos/events

CloudEvents 1.0 envelope builder and JSON Schema validator for CortexOS. Every NATS publish, webhook payload, and audit row in CortexOS MUST be wrapped through this package.

## Install

Workspace package. Reference via `"@cortexos/events": "*"` in your `package.json` and rely on npm workspaces (`npm install` at repo root).

## Usage

```js
import { envelope, validate, parse } from "@cortexos/events";

// Build
const ev = envelope({
  type: "cortex.paperclip.work.eng-backend.v1",
  source: "cortex-paperclip-bridge",
  subject: "ISSUE-42",
  data: { runId, issueId, agentId, role: "eng-backend", wakeReason: "manual", payload: body },
});

// Validate (throws EnvelopeValidationError)
validate(ev);

// Publish via NATS
nc.publish(subject, sc.encode(JSON.stringify(ev)));

// Consume
const incoming = parse(msg.data); // throws on invalid envelope or data
```

## API

- `envelope({ type, source, data, subject?, traceparent? })` — returns CloudEvents object with auto-filled `specversion`, `id` (uuid v4), `time` (ISO 8601), `datacontenttype`, `dataschema`.
- `validate(event)` — throws `EnvelopeValidationError` on failure; returns `true`.
- `parse(bytes|string)` — `JSON.parse` then `validate`. Returns the parsed event.
- `loadSchemas(dir?)` — registers schemas under `schemas/` (relative to repo root by default). Called lazily by `validate`/`parse`.
- `schemaFileForType(type)` — maps a CloudEvents `type` to its data-schema filename. Pure; safe to use in tests/CI.

## Event `type` convention

```text
cortex.<namespace>.<verb>.<scope>.v<N>
```

See `schemas/README.md` for the full registry.

## Backward compatibility

During the v2 rollout, set `CORTEX_REQUIRE_ENVELOPE=0` (default) in consumers to accept legacy non-enveloped payloads and warn. Set `CORTEX_REQUIRE_ENVELOPE=1` to reject anything that fails `validate()`.

## Errors

`EnvelopeValidationError` carries `.errors` (Ajv error array) when validation failed against a schema.
