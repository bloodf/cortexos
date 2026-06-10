/**
 * Local SvelteKit-compatible type shim.
 *
 * Why this exists:
 * The dashboard package is being migrated from Next.js to SvelteKit (M1-WS2
 * by Ada). Until that lands, the new server-side code in `src/lib/server/`
 * and `src/routes/api/` needs to type-check against SvelteKit's
 * `RequestEvent` shape without pulling SvelteKit as a dependency (which
 * would conflict with the existing Next.js install).
 *
 * Migration path:
 * When the SvelteKit foundation is in place, replace the import:
 *   import type { RequestEvent } from './types';
 * with:
 *   import type { RequestEvent } from '@sveltejs/kit';
 * The shape is intentionally identical to SvelteKit's `RequestEvent`.
 *
 * Compatibility:
 * This shim is a SUBSET of the SvelteKit `RequestEvent` interface. Only the
 * members we actually use are declared. When the real SvelteKit types are
 * adopted, additional members (cookies.set, fetch, etc.) will be available.
 */

import type { User, Session } from "./entities";

/** What we store on `event.locals` after a request has been authenticated. */
export interface AppLocals extends Record<string, unknown> {
  /** Present only if a valid session was found. */
  user?: User;
  /** Present only if a valid session was found. */
  session?: Session;
}

/**
 * Minimal SvelteKit-compatible `RequestEvent`.
 * Mirrors `@sveltejs/kit` `RequestEvent` (subset we need for M1).
 */
export interface RequestEvent {
  readonly request: Request;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  readonly route: { id: string | null };
  readonly locals: AppLocals;
  /** Cookies for the current request. */
  readonly cookies: CookiesAdapter;
  /** Best-effort client IP (X-Forwarded-For aware). */
  getClientAddress: () => string;
  /** Returns the platform-specific adapter (we stub for now). */
  readonly platform?: unknown;
}

/** Minimal cookie adapter — subset of SvelteKit's `Cookies` interface. */
export interface CookiesAdapter {
  /**
   * Get a cookie's value. The opts are accepted as `any` to stay
   * compatible with SvelteKit's `CookieParseOptions` shape while
   * still satisfying the cookie helpers that pass `{ path }`. The
   * only field we actually read is `path`; the rest is forwarded.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (name: string, opts?: any) => string | undefined;
  /**
   * Set a cookie. The cookie helpers (`setSessionCookie`,
   * `setCsrfCookie`) always pass the full opts object; the adapter
   * is free to accept a partial object too (matching real SvelteKit).
   */
  set?: (
    name: string,
    value: string,
    opts: {
      path: string;
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
      maxAge?: number;
    },
  ) => void;
  /** Delete a cookie. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete?: (name: string, opts?: any) => void;
}

/** The argument passed to `error()` in SvelteKit. */
export interface ErrorBody {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Subset of `SvelteKit` re-exports. These are the only SvelteKit helpers we
 * need. Real SvelteKit's `error()` returns `never`; ours does the same.
 */
export interface SvelteKitShim {
  error: (status: number, body: ErrorBody | string) => never;
  json: <T>(data: T, init?: ResponseInit) => Response;
  fail: <T extends Record<string, unknown> | undefined = undefined>(
    status: number,
    data?: T,
  ) => { status: number; data: T | undefined };
}
