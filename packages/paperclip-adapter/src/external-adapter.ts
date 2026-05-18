/**
 * ExternalAdapter — implements the Paperclip external-adapter primitive contract.
 *
 * Stateless façade over an HTTP transport (defaults to `undici.fetch`).
 * Exposes the three primitives Paperclip's worker loop requires:
 *   - `poll`     : fetch inbox-lite items
 *   - `checkout` : claim an issue for a run
 *   - `complete` : mark a run complete with PATCH semantics
 *
 * No retry/backoff here — bridge layer owns that. This stays stateless and
 * deterministic so it can be wrapped or replayed in tests.
 */

import { fetch as undiciFetch } from "undici";
import type { AdapterResult } from "./types.js";

type FetchLike = (url: string, init?: any) => Promise<Response | any>;

export interface ExternalAdapterOptions {
  baseUrl: string;
  token: string;
  /** Inject a fetch implementation (defaults to undici.fetch). */
  fetchImpl?: FetchLike;
}

export interface PollResult {
  items: Array<{ id: string; title?: string; status?: string }>;
}

export interface CheckoutResult {
  issueId: string;
  runId: string;
  claimed: boolean;
}

export interface CompleteResult {
  issueId: string;
  status: string;
}

export class ExternalAdapter {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: ExternalAdapterOptions) {
    if (!opts.baseUrl) throw new TypeError("ExternalAdapter: baseUrl required");
    if (!opts.token) throw new TypeError("ExternalAdapter: token required");
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.fetchImpl = opts.fetchImpl ?? (undiciFetch as unknown as FetchLike);
  }

  /** Fetch the lite inbox for this agent. */
  async poll(): Promise<AdapterResult<PollResult>> {
    return this.request<PollResult>("GET", "/api/agents/me/inbox-lite");
  }

  /** Claim an issue for a given runId. */
  async checkout(issueId: string, runId: string): Promise<AdapterResult<CheckoutResult>> {
    if (!issueId) throw new TypeError("ExternalAdapter.checkout: issueId required");
    if (!runId) throw new TypeError("ExternalAdapter.checkout: runId required");
    const res = await this.request<{ issueId?: string; status?: string }>(
      "POST",
      `/api/issues/${encodeURIComponent(issueId)}/checkout`,
      { runId },
      { body: {} },
    );
    return {
      ok: res.ok,
      status: res.status,
      error: res.error,
      data: res.ok
        ? { issueId, runId, claimed: true }
        : { issueId, runId, claimed: false },
    };
  }

  /** Complete a run by PATCHing the issue. */
  async complete(
    issueId: string,
    runId: string,
    body: Record<string, unknown>,
  ): Promise<AdapterResult<CompleteResult>> {
    if (!issueId) throw new TypeError("ExternalAdapter.complete: issueId required");
    if (!runId) throw new TypeError("ExternalAdapter.complete: runId required");
    const res = await this.request<{ status?: string }>(
      "PATCH",
      `/api/issues/${encodeURIComponent(issueId)}`,
      { runId },
      { body },
    );
    return {
      ok: res.ok,
      status: res.status,
      error: res.error,
      data: res.ok ? { issueId, status: res.data?.status ?? "completed" } : null,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    headers: { runId?: string } = {},
    init: { body?: unknown } = {},
  ): Promise<AdapterResult<T>> {
    const url = `${this.baseUrl}${path}`;
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
    if (headers.runId) h["X-Paperclip-Run-Id"] = headers.runId;

    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: h,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      const data = (await safeJson(res)) as T | null;
      return {
        ok: Boolean(res.ok),
        status: typeof res.status === "number" ? res.status : 0,
        data,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, status: 0, data: null, error: msg };
    }
  }
}

async function safeJson(res: any): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
