/**
 * HttpAdapter — wraps Paperclip's HTTP webhook configuration contract.
 *
 * Produces an immutable `HttpAdapterConfig` payload that can be POSTed
 * to Paperclip's agent-registration endpoint to bind a role to a webhook.
 */

import type { HttpAdapterConfig, RoleId } from "./types.js";

export interface HttpAdapterOptions {
  /** Default event types if `register` does not supply them. */
  defaultEvents?: readonly string[];
  /** Override the clock — useful for tests. */
  now?: () => Date;
}

const DEFAULT_EVENTS: readonly string[] = ["issue.created", "issue.updated", "issue.assigned"];

export class HttpAdapter {
  private readonly defaultEvents: readonly string[];
  private readonly now: () => Date;

  constructor(opts: HttpAdapterOptions = {}) {
    this.defaultEvents = opts.defaultEvents ?? DEFAULT_EVENTS;
    this.now = opts.now ?? (() => new Date());
  }

  /**
   * Build an HTTP webhook adapter config for the given role.
   *
   * @throws TypeError when role, webhookUrl, or secret are blank
   * @throws TypeError when webhookUrl is not a valid http(s) URL
   */
  register(
    role: RoleId,
    webhookUrl: string,
    secret: string,
    events?: readonly string[],
  ): HttpAdapterConfig {
    if (!role || typeof role !== "string") {
      throw new TypeError("HttpAdapter.register: role must be a non-empty string");
    }
    if (!secret || typeof secret !== "string") {
      throw new TypeError("HttpAdapter.register: secret must be a non-empty string");
    }
    assertValidWebhookUrl(webhookUrl);

    return Object.freeze({
      kind: "http" as const,
      role,
      webhookUrl,
      secret,
      events: Object.freeze([...(events ?? this.defaultEvents)]),
      registeredAt: this.now().toISOString(),
    });
  }
}

function assertValidWebhookUrl(webhookUrl: string): void {
  if (!webhookUrl || typeof webhookUrl !== "string") {
    throw new TypeError("HttpAdapter.register: webhookUrl must be a non-empty string");
  }
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    throw new TypeError(`HttpAdapter.register: webhookUrl is not a valid URL: ${webhookUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError(
      `HttpAdapter.register: webhookUrl protocol must be http or https, got ${parsed.protocol}`,
    );
  }
}
