/**
 * Shared type definitions for the Paperclip adapter package.
 */

/** Identifier for a Paperclip-registered agent role. */
export type RoleId = string;

/** HTTP webhook adapter configuration payload returned by `HttpAdapter.register`. */
export interface HttpAdapterConfig {
  /** Adapter kind discriminator — always "http" for HttpAdapter. */
  kind: 'http';
  /** Agent role this adapter is bound to. */
  role: RoleId;
  /** Fully qualified webhook URL Paperclip will POST events to. */
  webhookUrl: string;
  /** HMAC shared secret Paperclip uses to sign event payloads. */
  secret: string;
  /** Optional list of event types the webhook should receive. */
  events?: readonly string[];
  /** ISO-8601 timestamp the config was generated. */
  registeredAt: string;
}

/** Per-step entry inside an OMC artifact transcript. */
export interface TranscriptStep {
  role: string;
  action: string;
  content: string;
  timestamp: string;
}

/** Top-level OMC artifact JSON shape used by `parseTranscript`. */
export interface OmcArtifact {
  taskId: string;
  runId: string;
  steps: readonly TranscriptStep[];
  result?: string | Record<string, unknown> | null;
}

/** Rich-comment block emitted into Paperclip-friendly markdown blocks. */
export type RichCommentBlock =
  | { type: 'heading'; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'code'; content: string }
  | { type: 'list'; content: string[] };

/** Lightweight result envelope returned by external-adapter primitives. */
export interface AdapterResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}
