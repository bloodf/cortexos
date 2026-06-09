/**
 * Typed fetch core for the CortexOS dashboard API client.
 *
 * Responsibilities:
 * - Attaches `credentials: 'same-origin'` so the `cortexos_session` cookie
 *   is sent automatically on every request.
 * - On non-GET requests reads the `cortexos_csrf` cookie (intentionally NOT
 *   HttpOnly — double-submit design, WP-01/cookies.ts) and injects it as the
 *   `x-csrf-token` header.
 * - Parses the JSON response; on non-2xx status throws a typed `ApiClientError`
 *   that carries the full typed error envelope from 01-API-CONTRACT.md.
 */

/** Error codes from the typed error envelope (01-API-CONTRACT.md). */
export type ApiErrorCode =
  | "validation"
  | "auth"
  | "permission"
  | "not_found"
  | "rate_limit"
  | "approval_required"
  | "system";

/** Typed error envelope as returned by the server. */
export interface ApiErrorEnvelope {
  code: ApiErrorCode;
  message: string;
  /** Present when code=validation */
  details?: { field: string; message: string }[];
  /** Present when code=rate_limit — seconds until retry */
  retryAfter?: number;
  /** Present when code=approval_required — action key for the approvals flow */
  action?: string;
  /** Present when code=approval_required — TTL in seconds for the approval token */
  ttlSec?: number;
}

/** Thrown by `request<T>` on any non-2xx response. */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: { field: string; message: string }[];
  readonly retryAfter?: number;
  readonly action?: string;
  readonly ttlSec?: number;

  constructor(envelope: ApiErrorEnvelope, status: number) {
    super(envelope.message);
    this.name = "ApiClientError";
    this.code = envelope.code;
    this.status = status;
    this.details = envelope.details;
    this.retryAfter = envelope.retryAfter;
    this.action = envelope.action;
    this.ttlSec = envelope.ttlSec;
  }
}

/** Read the `cortexos_csrf` CSRF cookie from `document.cookie`. */
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("cortexos_csrf="));
  return match ? decodeURIComponent(match.slice("cortexos_csrf=".length)) : null;
}

/** Convert `ListParams`-style keys into a `Record<string,string>` suitable for URLSearchParams. */
function toQueryRecord(
  params: Record<string, string | number | boolean | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) {
      out[k] = String(v);
    }
  }
  return out;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Core typed fetch wrapper.
 *
 * @param method  HTTP method (GET, POST, PATCH, DELETE, PUT).
 * @param path    Absolute path starting with `/api/`.
 * @param options Optional query params, JSON body, and AbortSignal.
 * @returns       Parsed JSON body typed as `T`.
 * @throws        `ApiClientError` on non-2xx responses.
 */
export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { query, body, signal } = options;

  // Build URL with query string.
  let url = path;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(toQueryRecord(query));
    url = `${path}?${params.toString()}`;
  }

  // Build headers.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Inject CSRF token on all non-GET requests (double-submit cookie pattern).
  const upperMethod = method.toUpperCase();
  if (upperMethod !== "GET" && upperMethod !== "HEAD") {
    const csrf = readCsrfCookie();
    if (csrf) {
      headers["x-csrf-token"] = csrf;
    }
  }

  const response = await fetch(url, {
    method: upperMethod,
    credentials: "same-origin",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // Parse JSON body regardless of status (server always sends JSON).
  let data: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // Attempt to parse as a typed error envelope.
    const envelope = data as Partial<ApiErrorEnvelope>;
    const code: ApiErrorCode =
      isApiErrorCode(envelope.code) ? envelope.code : "system";
    throw new ApiClientError(
      {
        code,
        message: envelope.message ?? `HTTP ${response.status}`,
        details: envelope.details,
        retryAfter: envelope.retryAfter,
        action: envelope.action,
        ttlSec: envelope.ttlSec,
      },
      response.status,
    );
  }

  return data as T;
}

function isApiErrorCode(v: unknown): v is ApiErrorCode {
  return (
    v === "validation" ||
    v === "auth" ||
    v === "permission" ||
    v === "not_found" ||
    v === "rate_limit" ||
    v === "approval_required" ||
    v === "system"
  );
}
