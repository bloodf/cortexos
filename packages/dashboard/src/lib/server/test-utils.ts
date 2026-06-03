/**
 * Test helpers for the +server.ts handlers.
 *
 * Builds a fake `RequestEvent` that the route handlers can consume.
 * The fake event matches the local `RequestEvent` shim shape (see
 * `src/lib/server/types.ts`).
 */

import type { AppLocals, RequestEvent, CookiesAdapter } from './types';
import type { Session, User } from './entities';

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

  const cookieAdapter: CookiesAdapter = {
    get: (name: string) => cookies[name],
  };

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

/** Build a fake authenticated User for use in tests. */
export function makeFakeUser(overrides: Partial<User> = {}): User {
  return {
    id: ('user_' + Math.random().toString(36).slice(2, 10)) as User['id'],
    username: overrides.username ?? 'testuser',
    is_admin: overrides.is_admin ?? false,
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
