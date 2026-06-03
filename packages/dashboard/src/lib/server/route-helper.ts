/**
 * Internal helper for +server.ts handlers — wraps the common pattern of
 *   1. parse + validate body with Zod
 *   2. require auth (or admin, or group)
 *   3. apply rate limit
 *   4. apply policy (if it's a privileged op)
 *   5. audit
 *   6. return the result
 *
 * Not exported as part of the public API; the +server.ts files import it
 * for DRY.
 */

import { z, type ZodType } from 'zod';
import type { RequestEvent } from './types';
import type { User } from './entities';
import {
  isApiError,
  authError,
  notFoundError,
  permissionError,
  rateLimitError,
  systemError,
  type ApiError,
} from './errors/types';
import { jsonError, ApiErrorThrown } from './errors';
import { audit, type AuditInput } from './audit';
import { checkRateLimit, type RateLimitResult } from './rate-limit';
import { requireAuth, requireAdmin, clientIp, userAgent, isAdmin as isAdminUser } from './auth';
import type { GroupName } from './entities';

// ---------------------------------------------------------------------------
// HTTP-method request handler
// ---------------------------------------------------------------------------

export type Handler<TIn, TOut> = (args: {
  user: User;
  input: TIn;
  event: RequestEvent;
}) => Promise<TOut> | TOut;

export interface RouteOptions<TIn, TOut> {
  /** HTTP methods this route accepts. */
  methods: ReadonlyArray<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>;
  /** Optional input schema. GET/DELETE typically have no body; POST/PUT/PATCH usually do. */
  input?: ZodType<TIn>;
  /** Required role: 'any' | 'admin' | a specific group. */
  auth: 'any' | 'admin' | GroupName;
  /** Rate-limit configuration. Defaults: unauth=none, auth=10/min, admin=30/min, unauth-strict=30/min. */
  rateLimit?: { limit: number; windowSec: number; bucket: 'ip' | 'user' };
  /** Surface name for the audit log (THREAT_MODEL §6.2). */
  surface: string;
  /** Action name for the audit log (e.g. `services.list`, `services.create`). */
  action: string;
  /** Target string for the audit log (typically a resource id). */
  target?: (input: TIn, event: RequestEvent) => string | null;
  /** The actual handler. */
  handler: Handler<TIn, TOut>;
}

/**
 * Build a SvelteKit `+server.ts` request handler. Returns an async function
 * suitable for `export const GET/POST/...` in a `+server.ts` file.
 *
 * The wrapper handles:
 *   - method matching
 *   - input parsing + validation
 *   - auth gate
 *   - rate limiting
 *   - audit logging (on both success and failure)
 *   - error mapping to JSON responses
 */
export function defineRoute<TIn, TOut>(
  opts: RouteOptions<TIn, TOut>,
): (event: RequestEvent) => Promise<Response> {
  return async (event: RequestEvent): Promise<Response> => {
    const method = event.request.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    if (!opts.methods.includes(method)) {
      return new Response('Method not allowed', {
        status: 405,
        headers: { allow: opts.methods.join(', ') },
      });
    }

    // --- 1. Input parsing ---
    let input: TIn;
    if (opts.input) {
      const raw = await readRequestInput(event);
      const parsed = opts.input.safeParse(raw);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => ({
          field: i.path.join('.') || '_root',
          message: i.message,
        }));
        const e: ApiError = { kind: 'validation', message: 'Validation failed', details };
        await safeAudit(event, opts, null, e, null);
        return jsonError(e);
      }
      input = parsed.data;
    } else {
      input = {} as TIn;
    }

    // --- 2. Auth ---
    let user: User;
    try {
      if (opts.auth === 'admin') {
        user = requireAdmin(event);
      } else if (opts.auth === 'any') {
        user = requireAuth(event);
      } else {
        // specific group
        user = requireAuth(event);
        if (!user.groupMemberships.includes(opts.auth)) {
          const e: ApiError = {
            kind: 'permission',
            message: `Group '${opts.auth}' required`,
          };
          await safeAudit(event, opts, null, e, input);
          return jsonError(e);
        }
      }
    } catch (e) {
      const apiErr = extractApiError(e);
      if (apiErr) {
        await safeAudit(event, opts, null, apiErr, input);
        return jsonError(apiErr);
      }
      throw e;
    }

    // --- 3. Rate limit ---
    if (opts.rateLimit) {
      const ip = clientIp(event);
      const route = event.url.pathname;
      const key =
        opts.rateLimit.bucket === 'ip' ? `ip:${ip}:${route}` : `user:${user.id}:${route}`;
      const result: RateLimitResult = checkRateLimit({
        key,
        limit: opts.rateLimit.limit,
        windowSec: opts.rateLimit.windowSec,
      });
      if (!result.allowed) {
        const e: ApiError = {
          kind: 'rate_limit',
          message: 'Too many requests',
          retryAfter: result.retryAfterSec,
        };
        await safeAudit(event, opts, user, e, input);
        return jsonError(e);
      }
    }

    // --- 4. Handler ---
    try {
      const data = await opts.handler({ user, input, event });
      await safeAudit(event, opts, user, null, input, data);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    } catch (e) {
      const apiErr = extractApiError(e);
      if (apiErr) {
        await safeAudit(event, opts, user, apiErr, input);
        return jsonError(apiErr);
      }
      const e2: ApiError = { kind: 'system', message: 'Internal error' };
      await safeAudit(event, opts, user, e2, input);
      return jsonError(e2);
    }
  };
}

/**
 * Extract an `ApiError` from a thrown value. Returns `null` for non-ApiError
 * throws. Recognizes both raw `ApiError` values and `ApiErrorThrown` (which
 * wraps an `ApiError` from `apiError()`). When the shim's `error()` throws
 * without the wrapped `apiError`, we reconstruct from the body.
 */
function extractApiError(e: unknown): ApiError | null {
  if (isApiError(e)) return e;
  if (e instanceof ApiErrorThrown) {
    if (e.apiError) return e.apiError;
    if (e.body.code === 'auth') return authError(e.body.message);
    if (e.body.code === 'permission') return permissionError(e.body.message);
    if (e.body.code === 'validation') {
      return {
        kind: 'validation',
        message: e.body.message,
        details: Array.isArray(e.body.details) ? e.body.details : [],
      };
    }
    if (e.body.code === 'not_found') return notFoundError(e.body.message);
    if (e.body.code === 'rate_limit') {
      return { kind: 'rate_limit', message: e.body.message, retryAfter: 60 };
    }
    if (e.body.code === 'approval_required') {
      return {
        kind: 'approval_required',
        message: e.body.message,
        actionHash: '',
        ttlSec: 60,
      };
    }
    if (e.body.code === 'system') return systemError(e.body.message);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readRequestInput(event: RequestEvent): Promise<unknown> {
  const method = event.request.method;
  if (method === 'GET' || method === 'DELETE') {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of event.url.searchParams.entries()) {
      obj[k] = v;
    }
    return obj;
  }
  const ct = event.request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return await event.request.json();
    } catch {
      return null;
    }
  }
  try {
    const fd = await event.request.formData();
    const out: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v !== 'string') continue;
      out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

async function safeAudit<TIn>(
  event: RequestEvent,
  opts: RouteOptions<TIn, unknown>,
  user: User | null,
  err: ApiError | null,
  input: TIn | null,
  successData?: unknown,
): Promise<void> {
  try {
    const ip = clientIp(event);
    const ua = userAgent(event);
    const target = opts.target ? opts.target(input as TIn, event) : null;
    const result: AuditInput['result'] = err
      ? err.kind === 'permission' || err.kind === 'auth'
        ? 'denied'
        : 'failure'
      : 'success';
    const basePayload: Record<string, unknown> = {
      method: event.request.method,
      path: event.url.pathname,
      query: event.url.search,
    };
    if (target) basePayload.target = target;
    if (err) basePayload.error = { kind: err.kind, message: err.message };
    if (successData !== undefined) {
      basePayload.response_kind = typeof successData;
    }
    audit({
      actorUserId: user?.id ?? null,
      actorSessionId: event.locals.session?.id ?? null,
      actorIp: ip,
      actorUserAgent: ua,
      surface: opts.surface,
      action: opts.action,
      target,
      result,
      errorCode: err?.kind ?? null,
      payload: basePayload,
    });
  } catch {
    // Never let audit failures break the request.
  }
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { z };
export { isAdminUser as isAdmin };
