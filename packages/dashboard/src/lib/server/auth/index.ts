/**
 * Auth helpers — `requireAuth`, `requireAdmin`, `requireGroup`.
 *
 * M1 implementation: stubs that read a fake session from the
 * `cortexos_session` cookie. The cookie is expected to hold a JSON
 * `{ userId, sessionId, isAdmin, groups }` payload (or be a session-id
 * that we resolve from an in-memory map).
 *
 * Real PAM wiring is M3 (THREAT_MODEL §1.2 surface 1).
 *
 * Public API:
 *   - requireAuth(event)   → User (any authenticated user)
 *   - requireAdmin(event)  → User (must be in `cortexos-admin`)
 *   - requireGroup(event, group) → User (must be in the given group)
 *   - isAdmin(user)        → boolean (single source of truth per SR-003)
 *   - hasGroup(user, group)→ boolean
 *   - registerFakeUser(user)  → test helper
 *   - registerFakeSession(sessionId, user) → test helper
 *   - clearFakeAuth()      → test helper
 */

import { apiError } from '../errors';
import { authError, permissionError } from '../errors/types';
import { SESSION_COOKIE } from '../config';
import type { GroupName, Session, User } from '../entities';
import type { RequestEvent } from '../types';

// ---------------------------------------------------------------------------
// In-memory fake user + session store
// ---------------------------------------------------------------------------

const users = new Map<string, User>();
const sessions = new Map<string, Session>();

/** Test helper: register a fake user. Idempotent on `id`. */
export function registerFakeUser(user: User): void {
  users.set(user.id, user);
}

/** Test helper: register a fake session → user mapping. */
export function registerFakeSession(session: Session): void {
  sessions.set(session.id, session);
}

/** Test helper: clear all fake users and sessions. */
export function clearFakeAuth(): void {
  users.clear();
  sessions.clear();
}

// ---------------------------------------------------------------------------
// Internal: read session + user from event
// ---------------------------------------------------------------------------

function readSessionFromCookies(event: RequestEvent): Session | null {
  // Real SvelteKit exposes `event.cookies.get('cortexos_session')` which
  // returns the raw cookie value. We expect either:
  //   (a) the cookie value IS the session id
  //   (b) the cookie value is a JSON-encoded `{ sessionId, ... }`
  // M3 will replace this with real session-store lookup. For M1, option (a).
  const raw = event.cookies.get(SESSION_COOKIE);
  if (!raw) return null;
  return sessions.get(raw) ?? null;
}

function readSessionFromLocals(event: RequestEvent): Session | null {
  return event.locals.session ?? null;
}

function readSession(event: RequestEvent): Session | null {
  return readSessionFromLocals(event) ?? readSessionFromCookies(event);
}

function readUser(event: RequestEvent): User | null {
  // Prefer the locals-injected user (set by hooks.server.ts in the real
  // SvelteKit flow). Fall back to the session-store lookup.
  const fromLocals = event.locals.user;
  if (fromLocals) return fromLocals;
  const session = readSession(event);
  if (!session) return null;
  return users.get(session.userId) ?? null;
}

// ---------------------------------------------------------------------------
// RBAC predicates — single source of truth (SR-003)
// ---------------------------------------------------------------------------

/**
 * `isAdmin` returns `true` iff the user is a member of `cortexos-admin`.
 * `sudo` and `wheel` MUST NOT grant admin (THREAT_MODEL SR-003).
 */
export function isAdmin(user: User): boolean {
  return user.groupMemberships.includes('cortexos-admin') || user.is_admin;
}

/** Does the user hold a given group membership? */
export function hasGroup(user: User, group: GroupName): boolean {
  return user.groupMemberships.includes(group);
}

// ---------------------------------------------------------------------------
// Public API: require* helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the request is authenticated. Returns the user on success;
 * otherwise throws via `apiError` with a 401.
 */
export function requireAuth(event: RequestEvent): User {
  const user = readUser(event);
  if (!user) {
    apiError(event, authError('Authentication required'));
  }
  if (!user.isActive) {
    apiError(event, authError('Account is inactive'));
  }
  return user;
}

/**
 * Ensure the request is authenticated AND the user is an admin. Returns
 * the user on success; otherwise throws with 401 (unauthenticated) or 403
 * (authenticated but not admin).
 */
export function requireAdmin(event: RequestEvent): User {
  const user = requireAuth(event);
  if (!isAdmin(user)) {
    apiError(event, permissionError('Admin role required'));
  }
  return user;
}

/**
 * Ensure the request is authenticated AND the user is in `group`. Returns
 * the user on success; otherwise throws with 403.
 */
export function requireGroup(event: RequestEvent, group: GroupName): User {
  const user = requireAuth(event);
  if (!hasGroup(user, group)) {
    apiError(event, permissionError(`Group '${group}' required`));
  }
  return user;
}

// ---------------------------------------------------------------------------
// Audit-context helper — pull IP + UA for the audit log
// ---------------------------------------------------------------------------

export function clientIp(event: RequestEvent): string {
  return event.getClientAddress();
}

export function userAgent(event: RequestEvent): string | null {
  return event.request.headers.get('user-agent');
}
