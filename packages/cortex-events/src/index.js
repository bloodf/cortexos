/**
 * @cortexos/events — CloudEvents 1.0 envelope builder + JSON Schema validator.
 *
 * Public API:
 *   envelope({ type, source, data, subject?, traceparent? }) → CloudEvents object
 *   validate(event) → true | throws EnvelopeValidationError
 *   parse(bytes|string) → validated event
 *   loadSchemas(dir?) → registers all *.json schemas
 *   schemaFileForType(type) → schema filename (testable mapping)
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { v4 as uuidv4 } from "uuid";

export class EnvelopeValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = "EnvelopeValidationError";
    this.errors = errors || [];
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_SCHEMAS_DIR = resolve(__dirname, "../../../schemas");

let ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

let schemasLoaded = false;
let baseValidator = null;
let dataValidators = new Map(); // filename → compiled validator

/**
 * Map CloudEvents `type` → schema filename.
 *
 * Rules:
 *   - `cortex.paperclip.<verb>.<scope>.v<N>` → `paperclip-<verb>-v<N>.json`
 *   - `cortex.<top>.<verb>.<scope>.v<N>` with top ∈ {alerts, graph, signal} → `cortex-<top>-v<N>.json`
 *     (these are namespace-as-top-level; verb/scope are routing-only)
 *   - fallback: `<namespace>-<verb>-v<N>.json`
 */
export function schemaFileForType(type) {
  if (typeof type !== "string") {
    throw new EnvelopeValidationError("type must be a string");
  }
  const parts = type.split(".");
  if (parts.length < 4 || parts[0] !== "cortex") {
    throw new EnvelopeValidationError(`unsupported event type: ${type}`);
  }
  const version = parts[parts.length - 1];
  if (!/^v[0-9]+$/.test(version)) {
    throw new EnvelopeValidationError(`event type missing v<N>: ${type}`);
  }
  const namespace = parts[1];
  const verb = parts[2];

  // Top-level namespace events (no verb dimension in schema filename).
  const collapsed = new Set(["alerts", "graph", "signal", "dlq", "health"]);
  if (collapsed.has(namespace)) {
    if (namespace === "graph") return `cortex-graph-state-${version}.json`;
    return `cortex-${namespace}-${version}.json`;
  }
  return `${namespace}-${verb}-${version}.json`;
}

export function loadSchemas(dir = DEFAULT_SCHEMAS_DIR) {
  if (schemasLoaded) return;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const path = resolve(dir, f);
    const schema = JSON.parse(readFileSync(path, "utf8"));
    if (f === "cloudevents-base.json") {
      baseValidator = ajv.compile(schema);
    } else {
      dataValidators.set(f, ajv.compile(schema));
    }
  }
  if (!baseValidator) {
    throw new Error(`cloudevents-base.json missing in ${dir}`);
  }
  schemasLoaded = true;
}

function ensureLoaded() {
  if (!schemasLoaded) loadSchemas();
}

/**
 * Build a CloudEvents 1.0 envelope.
 */
export function envelope({ type, source, data, subject, traceparent }) {
  if (typeof type !== "string" || !type) {
    throw new EnvelopeValidationError("envelope requires 'type'");
  }
  if (typeof source !== "string" || !source) {
    throw new EnvelopeValidationError("envelope requires 'source'");
  }
  const schemaFile = schemaFileForType(type);
  const event = {
    specversion: "1.0",
    id: uuidv4(),
    type,
    source,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    dataschema: `https://cortexos/schemas/${schemaFile}`,
  };
  if (subject) event.subject = subject;
  if (traceparent) event.traceparent = traceparent;
  if (data !== undefined) event.data = data;
  return event;
}

/**
 * Validate envelope + inner data shape. Throws EnvelopeValidationError on failure.
 */
export function validate(event) {
  ensureLoaded();
  if (!baseValidator(event)) {
    throw new EnvelopeValidationError(
      "envelope failed CloudEvents base validation",
      baseValidator.errors,
    );
  }
  const schemaFile = schemaFileForType(event.type);
  const dataValidator = dataValidators.get(schemaFile);
  if (!dataValidator) {
    throw new EnvelopeValidationError(
      `no data schema registered for type=${event.type} (expected ${schemaFile})`,
    );
  }
  if (!dataValidator(event.data)) {
    throw new EnvelopeValidationError(
      `event data failed validation against ${schemaFile}`,
      dataValidator.errors,
    );
  }
  return true;
}

export function parse(input) {
  const text = typeof input === "string" ? input : new TextDecoder().decode(input);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new EnvelopeValidationError(`invalid JSON: ${e.message}`);
  }
  validate(parsed);
  return parsed;
}

/**
 * Test-only: drop cached validators (used by tests that swap schema dirs).
 */
export function _resetForTesting() {
  schemasLoaded = false;
  baseValidator = null;
  dataValidators = new Map();
  ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
}
