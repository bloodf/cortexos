/**
 * Type declarations for @cortexos/events (JS source, JSDoc-light).
 * Mirrors the public surface of src/index.js.
 */

export class EnvelopeValidationError extends Error {
  errors: unknown[];
  constructor(message: string, errors?: unknown[]);
}

export interface CloudEvent<TData = unknown> {
  specversion: "1.0";
  id: string;
  type: string;
  source: string;
  time: string;
  datacontenttype: "application/json";
  dataschema: string;
  subject?: string;
  traceparent?: string;
  data?: TData;
}

export interface EnvelopeInput<TData = unknown> {
  type: string;
  source: string;
  data?: TData;
  subject?: string;
  traceparent?: string;
}

export function envelope<TData = unknown>(input: EnvelopeInput<TData>): CloudEvent<TData>;
export function validate(event: unknown): true;
export function parse<TData = unknown>(input: string | Uint8Array): CloudEvent<TData>;
export function loadSchemas(dir?: string): void;
export function schemaFileForType(type: string): string;
export function _resetForTesting(): void;
