/**
 * @cortexos/paperclip-adapter — public entry.
 */

export { HttpAdapter } from './http-adapter.js';
export type { HttpAdapterOptions } from './http-adapter.js';
export { ExternalAdapter } from './external-adapter.js';
export type {
  ExternalAdapterOptions,
  PollResult,
  CheckoutResult,
  CompleteResult,
} from './external-adapter.js';
export { parseTranscript } from './transcript-parser.js';
export type {
  HttpAdapterConfig,
  RoleId,
  TranscriptStep,
  OmcArtifact,
  RichCommentBlock,
  AdapterResult,
} from './types.js';
