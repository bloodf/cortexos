/**
 * Test helpers for the +server.ts handlers.
 *
 * Builds a fake `RequestEvent` that the route handlers can consume.
 *
 * M1.5 follow-up cleanup:
 *   The fake is constructed to be STRUCTURALLY compatible with
 *   `@sveltejs/kit`'s real `RequestEvent` (it has all the fields the
 *   production type requires: `request`, `url`, `params`, `route`,
 *   `locals`, `cookies`, `getClientAddress`). The auth helpers in
 *   `src/lib/server/auth/index.ts` declare an `AuthRequestEvent` with
 *   a structural shape — `cookies: any` — that accepts both this fake
 *   and a real SvelteKit event, so the M2 auth tests (auth.test.ts,
 *   auth-m2.test.ts) can pass a `makeFakeEvent(...)` result straight
 *   into `requireAuth` / `requireAdmin` / `getCurrentSession` without
 *   any casts.
 *
 *   The function's declared return type is the LOCAL `RequestEvent`
 *   shim from `./types` (a subset of SvelteKit's) because ~25 callsites
 *   in the `__tests__/` tree pass the result to functions declared
 *   against the local shim (`apiError`, `defineRoute`, `paginatedLoad`,
 *   `readJsonBody`, etc.). Swapping the return type to the real
 *   SvelteKit one would force every callsite to add `as unknown as`
 *   casts (the real type is generic and has more fields than the
 *   shim, so the shim-typed functions reject the wider SvelteKit
 *   value). The local shim is being phased out in favour of the
 *   SvelteKit type; this is a step on that path, not the destination.
 */

import type { AppLocals, RequestEvent } from './types';
import type { Session, User } from './entities';
import type { CookieJar } from './auth/cookies';

export interface FakeEventOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url?: string;
  body?: unknown;
  params?: Record<string, string>;
  /** Cookies on the request, keyed by name. */
  cookies?: Record<string, string>;
  /** Locals (set by hooks.server.ts in real SvelteKit). */
  locals?: AppLocals;
  ip?: string;
  userAgent?: string;
  headers?: Record<string, string>;
}

export function makeFakeEvent(opts: FakeEventOptions = {}): RequestEvent {
  const method = opts.method ?? 'GET';
  const url = new URL(opts.url ?? 'http://localhost/');
  const params: Record<string, string> = opts.params ?? {};
  const cookies: Record<string, string> = opts.cookies ?? {};
  const ip = opts.ip ?? '127.0.0.1';
  const ua = opts.userAgent ?? 'test-ua/1.0';

  const cookieAdapter = makeFakeCookieJar(cookies);

  const headers = new Headers(opts.headers ?? {});
  if (!headers.has('user-agent')) headers.set('user-agent', ua);
  if (method !== 'GET' && method !== 'DELETE' && opts.body !== undefined) {
    if (typeof opts.body === 'string') {
      headers.set('content-type', 'text/plain');
    } else {
      headers.set('content-type', 'application/json');
    }
  }

  const requestBody =
    method === 'GET' || method === 'DELETE'
      ? undefined
      : opts.body !== undefined
        ? typeof opts.body === 'string'
          ? opts.body
          : JSON.stringify(opts.body)
        : undefined;

  const request = new Request(url.toString(), {
    method,
    headers,
    body: requestBody,
  });

  const event: RequestEvent = {
    request,
    url,
    params,
    route: { id: null },
    locals: opts.locals ?? {},
    cookies: cookieAdapter,
    getClientAddress: () => ip,
  };
  return event;
}

/**
 * Build a fake cookie jar that records `set` / `delete` calls.
 *
 * The jar implements the `CookieJar` interface (subset of SvelteKit's
 * `cookies`) so it can be passed to the cookie helpers in tests.
 * `get` looks up request cookies, `set` updates the recorded
 * response cookies, and `delete` removes them.
 */
export interface FakeCookieJar extends CookieJar {
  /** All cookies set during the request (most recent last). */
  readonly response: ReadonlyArray<{ name: string; value: string; opts: object }>;
  /** All cookies deleted during the request. */
  readonly deleted: ReadonlyArray<{ name: string }>;
  /** Cookies visible to the request (input). */
  readonly request: Record<string, string>;
  /** Cookies sent in the response (output). */
  readonly responseMap: Record<string, string>;
  /** Mark a cookie as set in the response. */
  _set(name: string, value: string, opts: object): void;
  /** Mark a cookie as deleted in the response. */
  _delete(name: string): void;
}

export function makeFakeCookieJar(initial: Record<string, string> = {}): FakeCookieJar {
  const request = { ...initial };
  const responseMap: Record<string, string> = {};
  const response: Array<{ name: string; value: string; opts: object }> = [];
  const deleted: Array<{ name: string }> = [];
  const jar: FakeCookieJar = {
    get response() {
      return response;
    },
    get deleted() {
      return deleted;
    },
    get request() {
      return request;
    },
    get responseMap() {
      return responseMap;
    },
    _set(name, value, opts) {
      responseMap[name] = value;
      response.push({ name, value, opts });
    },
    _delete(name) {
      delete responseMap[name];
      deleted.push({ name });
    },
    get(name: string) {
      // Response cookies shadow request cookies (typical cookie-jar
      // semantics: the latest set wins).
      if (name in responseMap) return responseMap[name]!;
      if (name in request) return request[name]!;
      return undefined;
    },
    set(name, value, opts) {
      this._set(name, value, opts);
    },
    delete(name) {
      this._delete(name);
    },
  };
  return jar;
}

/** Build a fake authenticated User for use in tests. */
export function makeFakeUser(overrides: Partial<User> = {}): User {
  const isAdmin = overrides.isAdmin ?? overrides.is_admin ?? false;
  return {
    id: ('user_' + Math.random().toString(36).slice(2, 10)) as User['id'],
    username: overrides.username ?? 'testuser',
    is_admin: isAdmin,
    isAdmin,
    isActive: overrides.isActive ?? true,
    groupMemberships: overrides.groupMemberships ?? [],
  };
}

export function makeFakeSession(user: User, overrides: Partial<Session> = {}): Session {
  const now = Date.now();
  return {
    id: ('sess_' + Math.random().toString(36).slice(2, 10)) as Session['id'],
    userId: user.id,
    csrfToken: 'csrf-' + Math.random().toString(36).slice(2, 10),
    expiresAt: overrides.expiresAt ?? now + 24 * 60 * 60 * 1000,
    ua: overrides.ua ?? null,
    ip: overrides.ip ?? null,
    lastRoleCheckAt: overrides.lastRoleCheckAt ?? now,
  };
}

/** Build a `locals` object with user + session populated. */
export function makeFakeLocals(user: User, session: Session): AppLocals {
  return { user, session };
}
