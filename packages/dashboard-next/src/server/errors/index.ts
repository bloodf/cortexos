/**
 * Error helpers — map the contracts' `ApiError` discriminated union to
 * SvelteKit `error()` / `json()` responses.
 *
 * Public surface:
 *   - apiError(event, error) → throw a SvelteKit `error()` for the right code
 *   - jsonError(error) → return a JSON Response (useful for +server.ts)
 *   - httpStatusFor(error) → map an `ApiError` to an HTTP status code
 *
 * Status mapping (per THREAT_MODEL §2 and HTTP spec):
 *   - validation         → 400
 *   - auth               → 401
 *   - permission         → 403
 *   - not_found          → 404
 *   - rate_limit         → 429  + Retry-After header
 *   - approval_required  → 403  + X-Cortex-Confirmation-Token header
 *   - system             → 500
 */

import type { RequestEvent, SvelteKitShim, ErrorBody } from "../types";
import type { ApiError } from "./types";

// ---------------------------------------------------------------------------
// SvelteKit shim — until the real SvelteKit package is in place, the +server.ts
// handlers wire themselves through `setKitShim`. This is the same pattern
// SvelteKit itself uses to abstract `error()` / `json()`.
// ---------------------------------------------------------------------------

let shim: SvelteKitShim | null = null;

/** Inject the SvelteKit shim (called from the route files). */
export function setKitShim(s: SvelteKitShim): void {
  shim = s;
}

/** Used by the `+server.ts` shim below — `apiError` calls into this. */
function requireShim(): SvelteKitShim {
  if (shim) return shim;
  // Fallback: build a minimal in-process shim so error helpers work in
  // tests and in `+server.ts` handlers before the SvelteKit foundation
  // lands. The shim is identical in shape to SvelteKit's exports.
  return {
    error: ((status: number, body: ErrorBody) => {
      // SvelteKit's `error()` throws and is caught by the framework.
      // We replicate that contract by throwing a tagged error.
      throw new ApiErrorThrown(status, body);
    }) as SvelteKitShim["error"],
    json: ((data, init) => new Response(JSON.stringify(data), init)) as SvelteKitShim["json"],
    fail: ((status, data) => ({ status, data })) as SvelteKitShim["fail"],
  };
}

class ApiErrorThrown extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { message: string; code?: string; details?: unknown },
    public readonly apiError?: ApiError,
  ) {
    super(body.message);
    this.name = "ApiErrorThrown";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Map an `ApiError` to its HTTP status code. */
export function httpStatusFor(error: ApiError): number {
  switch (error.kind) {
    case "validation":
      return 400;
    case "auth":
      return 401;
    case "permission":
    case "approval_required":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "system":
      return 500;
  }
}

/**
 * Body shape returned to the client. Mirrors SvelteKit's `error()` payload
 * plus a `code` for machine consumption.
 */
export interface ApiErrorBody {
  message: string;
  code: ApiError["kind"];
  details?: unknown;
  /** For `approval_required`, the action hash the client should request a token for. */
  actionHash?: string;
  /** For `approval_required`, the suggested TTL in seconds. */
  ttlSec?: number;
}

export function errorBody(error: ApiError): ApiErrorBody {
  const base: ApiErrorBody = { message: error.message, code: error.kind };
  switch (error.kind) {
    case "validation":
      return { ...base, details: error.details };
    case "approval_required":
      return { ...base, actionHash: error.actionHash, ttlSec: error.ttlSec };
    default:
      return base;
  }
}

/**
 * Throw a SvelteKit `error()` with the right status for the given `ApiError`.
 *
 * In a SvelteKit `+server.ts` handler, this short-circuits the request with
 * the correct HTTP status. In a load function or form action, it surfaces
 * the error to the nearest `+error.svelte`.
 */
export function apiError(event: RequestEvent, error: ApiError): never {
  const sk = requireShim();
  const status = httpStatusFor(error);
  const body = errorBody(error);
  // SvelteKit's `error()` accepts either a string or an object. We use the
  // object form so the body fields are exposed to the client.
  const errBody: ErrorBody = { message: body.message, code: body.code, details: body.details };
  // Attach the original ApiError so the route helper can reconstruct it
  // for the audit log and JSON response.
  sk.error(status, errBody);
  throw new ApiErrorThrown(status, errBody, error);
}

/**
 * Return a `Response` with the right status + headers for an `ApiError`.
 *
 * Use this in `+server.ts` when you want to return a JSON response rather
 * than letting SvelteKit render an error page. This is the right choice
 * for JSON-only API endpoints.
 */
export function jsonError(error: ApiError): Response {
  const status = httpStatusFor(error);
  const body = errorBody(error);
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
  };
  if (error.kind === "rate_limit") {
    headers["retry-after"] = String(error.retryAfter);
  }
  if (error.kind === "approval_required") {
    // The `X-Cortex-Confirmation-Token` header is the required signal that
    // an approval flow is in progress. The token itself is fetched via
    // POST /api/approvals/request.
    headers["x-cortex-confirmation-token-required"] = "true";
    headers["x-cortex-approval-action-hash"] = error.actionHash;
    headers["x-cortex-approval-ttl-sec"] = String(error.ttlSec);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/** Exposed for tests so they can assert the throw contract. */
export { ApiErrorThrown };
