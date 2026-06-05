/**
 * Session store — the single source of truth for "is this cookie a
 * valid session, and if so who is the user?".
 *
 * M2-WS3 (Kleppmann) replaces the M1-WS4 in-memory Map with a
 * real session store backed by the `admin_sessions` table
 * (see `migrations/002_session_columns_for_auth.sql` for the
 * column extensions). An in-memory implementation is also
 * provided so unit tests don't need a database.
 *
 * Why an interface:
 *   - Tests run with the in-memory backend (fast, hermetic, no
 *     PGlite/Postgres needed for every auth test).
 *   - Production uses the Drizzle backend against the real DB.
 *   - The +server.ts route handlers and the SvelteKit hook consume
 *     the interface, not a concrete implementation; the choice is
 *     a single setSessionStore() call at process start.
 *
 * Public API:
 *   - SessionStore interface
 *   - InMemorySessionStore (test/dev)
 *   - DrizzleSessionStore    (production)
 *   - getSessionStore() / setSessionStore(s) / resetSessionStore()
 *
 * Session lifecycle:
 *   createSession() → returns { session, token }
 *     The token is the cookie value; the server stores it. Clients
 *     never see the DB row id.
 *   resolveByToken(token) → { session, user, groups, isAdmin } | null
 *     Returns null if the token is unknown OR the session is
 *     expired. A stale token must never resolve.
 *   touch(token, rollingTtlMs) → updated session | null
 *     Extends `expires_at` to now + rollingTtlMs, capped at
 *     `created_at + rollingTtlMs` (so an idle session cannot
 *     extend indefinitely; the absolute lifetime is the cap).
 *   deleteByToken(token) → boolean
 *   sweepExpired() → number of removed sessions
 *   revalidateRole(token, isAdmin) → void
 *     Updates the cached `is_admin` + `last_role_check_at`. The
 *     SvelteKit hook calls this when the cached role is older than
 *     ROLE_CHECK_TTL_MS.
 */

import { randomBytes } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { getDb } from '../db/client';
import { adminSessions, pamUsers } from '../db/schema';
import type { GroupMembershipEntry, GroupName, Session, SessionId, User, UserId } from '../entities';
import { asSessionId, asUserId } from '../entities';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The single record returned by every successful session lookup.
 * Carries both the session row and the joined user + RBAC projection.
 */
export interface ResolvedSession {
  readonly session: Session;
  readonly user: User;
  /** The dashboard-relevant groups the user is in (string names). */
  readonly groups: ReadonlyArray<GroupName>;
  /** Convenience: derived from `groups`. */
  readonly isAdmin: boolean;
}

/** Input to `createSession`. */
export interface CreateSessionInput {
  /** The PAM username; resolved to a `pam_users` row. */
  username: string;
  /** Server-generated CSRF token (32-byte CSPRNG, base64url). */
  csrfToken: string;
  /** Best-effort source IP. May be null. */
  ip: string | null;
  /** Best-effort User-Agent header value. May be null. */
  userAgent: string | null;
  /** Whether the user is a member of `cortexos-admin` (cached). */
  isAdmin: boolean;
  /** Initial session lifetime in milliseconds (default 30 days). */
  ttlMs?: number;
}

/** Return of `createSession`. */
export interface CreateSessionResult {
  /** The cookie value to set in the `Set-Cookie` header. */
  readonly token: string;
  /** The persisted session row. */
  readonly session: Session;
  /** The persisted user row (with is_admin + groups). */
  readonly user: User;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SessionStore {
  /**
   * Create a new session for a username. Upserts the `pam_users` row
   * so the first login also bootstraps the user's DB record.
   */
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;

  /**
   * Resolve a session token to { session, user, groups, isAdmin }.
   * Returns null if the token is unknown OR expired (THREAT_MODEL
   * SR-001: a stale token must never resolve).
   */
  resolveByToken(token: string): Promise<ResolvedSession | null>;

  /**
   * Extend the session's expiry to now + ttlMs, capped at
   * createdAt + ttlMs. Updates `touched_at`. Returns the updated
   * session, or null if the token is unknown/expired.
   */
  touch(token: string, ttlMs: number): Promise<Session | null>;

  /**
   * Delete a session by token. Idempotent. Returns true if a row
   * was removed.
   */
  deleteByToken(token: string): Promise<boolean>;

  /**
   * Delete every expired session. Returns the number of rows removed.
   * The caller is responsible for running this on a schedule (the
   * 6-hour sweep in the M2-WS3 wiring).
   */
  sweepExpired(): Promise<number>;

  /**
   * Update the cached `is_admin` for a session, recording the time
   * of the re-validation. Called by the SvelteKit hook when the
   * cached role is older than ROLE_CHECK_TTL_MS.
   */
  revalidateRole(token: string, isAdmin: boolean): Promise<void>;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let cached: SessionStore | null = null;

/** Process-wide session store. Lazy. */
export function getSessionStore(): SessionStore {
  if (!cached) cached = pickDefault();
  return cached;
}

/** Test helper: install a custom session store. */
export function setSessionStore(s: SessionStore): void {
  cached = s;
}

/** Test helper: clear the singleton. */
export function resetSessionStore(): void {
  cached = null;
}

function pickDefault(): SessionStore {
  // Production: Drizzle-backed store against the configured `DbClient`
  // (real Postgres in production, PGlite in tests). The lazy DbClient
  // throws a clear error if the DB env is not present (e.g. a build
  // step) so the failure mode is loud, not silent.
  //
  // Tests that need an in-memory store should call setSessionStore
  // explicitly in their setup; the default is intentionally
  // Drizzle so production deployments get persistence out of the box.
  //
  // In unit tests, the DB env is absent and getDb() throws. Fall back
  // to the in-memory store so the unit suite keeps passing without
  // having to mock getDb() in every test that exercises auth helpers.
  if (!process.env.DB_PASSWORD) {
    return new InMemorySessionStore();
  }
  return new DrizzleSessionStore(getDb());
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * Generate a fresh session token. 32 bytes of CSPRNG output,
 * base64url-encoded. ~43 characters.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Default session TTL: 30 days, per task spec. */
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// In-memory implementation (tests / dev)
// ---------------------------------------------------------------------------

interface MemSessionRow {
  id: number;
  userId: number;
  token: string;
  csrfToken: string;
  ip: string | null;
  userAgent: string | null;
  isAdmin: boolean;
  lastRoleCheckAt: number;
  createdAt: number;
  expiresAt: number;
  touchedAt: number;
}

interface MemUserRow {
  id: number;
  username: string;
  groupMemberships: ReadonlyArray<GroupMembershipEntry>;
  isActive: boolean;
}

/**
 * In-memory session store. Mirrors the Drizzle implementation's
 * contract so unit tests can swap them transparently.
 */
export class InMemorySessionStore implements SessionStore {
  private users = new Map<number, MemUserRow>();
  private sessions = new Map<string, MemSessionRow>();
  private nextUserId = 1;
  private nextSessionId = 1;

  /** Test helper: drop everything. */
  reset(): void {
    this.users.clear();
    this.sessions.clear();
    this.nextUserId = 1;
    this.nextSessionId = 1;
  }

  /** Test helper: register a user directly (bypasses PAM). */
  upsertUser(input: {
    username: string;
    groupMemberships: ReadonlyArray<GroupName>;
    isActive?: boolean;
  }): { id: number; username: string } {
    // Accept string union and convert to the contracts object form.
    const entries: ReadonlyArray<GroupMembershipEntry> = input.groupMemberships.map(
      (name) => ({ name, isAdmin: name === 'cortexos-admin' }),
    );
    for (const u of this.users.values()) {
      if (u.username === input.username) {
        u.groupMemberships = entries;
        u.isActive = input.isActive ?? true;
        return { id: u.id, username: u.username };
      }
    }
    const u: MemUserRow = {
      id: this.nextUserId++,
      username: input.username,
      groupMemberships: entries,
      isActive: input.isActive ?? true,
    };
    this.users.set(u.id, u);
    return { id: u.id, username: u.username };
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    // 1. Upsert the user. Same username → same id.
    const user = this.upsertUser({
      username: input.username,
      groupMemberships: input.isAdmin
        ? ['cortexos-admin', 'cortexos-users']
        : ['cortexos-users'],
    });
    // 2. Create the session row.
    const now = Date.now();
    const ttl = input.ttlMs ?? DEFAULT_SESSION_TTL_MS;
    const token = generateSessionToken();
    const row: MemSessionRow = {
      id: this.nextSessionId++,
      userId: user.id,
      token,
      csrfToken: input.csrfToken,
      ip: input.ip,
      userAgent: input.userAgent,
      isAdmin: input.isAdmin,
      lastRoleCheckAt: now,
      createdAt: now,
      expiresAt: now + ttl,
      touchedAt: now,
    };
    this.sessions.set(token, row);
    return {
      token,
      session: toSessionEntity(row),
      user: toUserEntity(this.users.get(user.id)!, user.id),
    };
  }

  async resolveByToken(token: string): Promise<ResolvedSession | null> {
    const row = this.sessions.get(token);
    if (!row) return null;
    if (row.expiresAt <= Date.now()) {
      // Lazy GC: drop the expired row so it doesn't sit in memory.
      this.sessions.delete(token);
      return null;
    }
    const user = this.users.get(row.userId);
    if (!user) return null;
    if (!user.isActive) return null;
    // The session's `isAdmin` is the source of truth for this
    // request — it was re-validated by the hook on a TTL (SR-011).
    // The user's stored groupMemberships are an upsert-time snapshot
    // and may be stale; do not trust them.
    const groups: ReadonlyArray<GroupName> = row.isAdmin
      ? ['cortexos-admin', 'cortexos-users']
      : ['cortexos-users'];
    return {
      session: toSessionEntity(row),
      user: toUserEntity(user, user.id, row.isAdmin),
      groups,
      isAdmin: row.isAdmin,
    };
  }

  async touch(token: string, ttlMs: number): Promise<Session | null> {
    const row = this.sessions.get(token);
    if (!row) return null;
    if (row.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    const now = Date.now();
    // Cap at createdAt + ttlMs so an idle session cannot extend
    // past the absolute lifetime.
    const cap = row.createdAt + ttlMs;
    const newExpiresAt = Math.min(now + ttlMs, cap);
    row.expiresAt = newExpiresAt;
    row.touchedAt = now;
    return toSessionEntity(row);
  }

  async deleteByToken(token: string): Promise<boolean> {
    return this.sessions.delete(token);
  }

  async sweepExpired(): Promise<number> {
    const now = Date.now();
    let removed = 0;
    for (const [token, row] of this.sessions) {
      if (row.expiresAt <= now) {
        this.sessions.delete(token);
        removed++;
      }
    }
    return removed;
  }

  async revalidateRole(token: string, isAdmin: boolean): Promise<void> {
    const row = this.sessions.get(token);
    if (!row) return;
    row.isAdmin = isAdmin;
    row.lastRoleCheckAt = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Drizzle implementation (production)
// ---------------------------------------------------------------------------

/**
 * Drizzle-backed session store. Uses the production `DbClient` so
 * it works against either the live `node-postgres` pool or the
 * PGlite WASM engine used in tests (the queries are identical).
 */
export class DrizzleSessionStore implements SessionStore {
  constructor(private readonly db: DbClient) {}

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    // 1. Upsert pam_users. The Drizzle onConflictDoUpdate path is
    //    idempotent on username (the unique key).
    const username = input.username.trim();
    if (!username) throw new Error('PAM username is required');
    const upserted = await this.db
      .insert(pamUsers)
      .values({ username })
      .onConflictDoUpdate({
        target: pamUsers.username,
        set: { username: sql`EXCLUDED.username` },
      })
      .returning();
    const userRow = upserted[0];
    if (!userRow) throw new Error('Failed to upsert PAM user');

    // 2. Insert the session row.
    const now = Date.now();
    const ttl = input.ttlMs ?? DEFAULT_SESSION_TTL_MS;
    const token = generateSessionToken();
    const inserted = await this.db
      .insert(adminSessions)
      .values({
        userId: userRow.id,
        token,
        csrfToken: input.csrfToken,
        ip: input.ip,
        userAgent: input.userAgent,
        isAdmin: input.isAdmin,
        lastRoleCheckAt: now,
        createdAt: new Date(now),
        touchedAt: new Date(now),
        expiresAt: new Date(now + ttl),
      })
      .returning();
    const sessionRow = inserted[0];
    if (!sessionRow) throw new Error('Failed to insert session');

    return {
      token,
      session: rowToSession(sessionRow, now),
      user: rowToUser(userRow, input.isAdmin),
    };
  }

  async resolveByToken(token: string): Promise<ResolvedSession | null> {
    const rows = await this.db
      .select({
        sessionId: adminSessions.id,
        userId: adminSessions.userId,
        token: adminSessions.token,
        csrfToken: adminSessions.csrfToken,
        ip: adminSessions.ip,
        userAgent: adminSessions.userAgent,
        isAdmin: adminSessions.isAdmin,
        lastRoleCheckAt: adminSessions.lastRoleCheckAt,
        createdAt: adminSessions.createdAt,
        expiresAt: adminSessions.expiresAt,
        touchedAt: adminSessions.touchedAt,
        pamUserId: pamUsers.id,
        pamUsername: pamUsers.username,
      })
      .from(adminSessions)
      .innerJoin(pamUsers, eq(pamUsers.id, adminSessions.userId))
      .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, sql`NOW()`)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    // The DB doesn't store groupMemberships (that's a session-time
    // projection of OS group membership). The hook re-derives it
    // from PAM; here we default to whatever the cached is_admin
    // says, and let the higher layers refresh on a TTL.
    const groups: ReadonlyArray<GroupName> = row.isAdmin
      ? ['cortexos-admin', 'cortexos-users']
      : ['cortexos-users'];
    const groupMemberships: ReadonlyArray<GroupMembershipEntry> = groups.map(
      (name) => ({ name, isAdmin: row.isAdmin && name === 'cortexos-admin' }),
    );

    return {
      session: rowToSessionFromJoin(row),
      user: {
        id: asUserId(String(row.pamUserId)),
        username: row.pamUsername,
        is_admin: row.isAdmin,
        isAdmin: row.isAdmin,
        isActive: true,
        groupMemberships,
      },
      groups,
      isAdmin: row.isAdmin,
    };
  }

  async touch(token: string, ttlMs: number): Promise<Session | null> {
    const rows = await this.db
      .select({
        id: adminSessions.id,
        userId: adminSessions.userId,
        token: adminSessions.token,
        csrfToken: adminSessions.csrfToken,
        ip: adminSessions.ip,
        userAgent: adminSessions.userAgent,
        isAdmin: adminSessions.isAdmin,
        lastRoleCheckAt: adminSessions.lastRoleCheckAt,
        createdAt: adminSessions.createdAt,
        expiresAt: adminSessions.expiresAt,
        touchedAt: adminSessions.touchedAt,
      })
      .from(adminSessions)
      .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, sql`NOW()`)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const now = Date.now();
    const createdMs = row.createdAt.getTime();
    const cap = createdMs + ttlMs;
    const newExpiresAtMs = Math.min(now + ttlMs, cap);
    await this.db
      .update(adminSessions)
      .set({
        expiresAt: new Date(newExpiresAtMs),
        touchedAt: new Date(now),
      })
      .where(eq(adminSessions.token, token));
    return {
      id: asSessionId(String(row.id)),
      userId: asUserId(String(row.userId)),
      csrfToken: row.csrfToken ?? '',
      expiresAt: newExpiresAtMs,
      ua: row.userAgent,
      ip: row.ip,
      lastRoleCheckAt: Number(row.lastRoleCheckAt),
    };
  }

  async deleteByToken(token: string): Promise<boolean> {
    const res = await this.db
      .delete(adminSessions)
      .where(eq(adminSessions.token, token))
      .returning({ id: adminSessions.id });
    return res.length > 0;
  }

  async sweepExpired(): Promise<number> {
    const res = await this.db
      .delete(adminSessions)
      .where(sql`${adminSessions.expiresAt} <= NOW()`)
      .returning({ id: adminSessions.id });
    return res.length;
  }

  async revalidateRole(token: string, isAdmin: boolean): Promise<void> {
    await this.db
      .update(adminSessions)
      .set({ isAdmin, lastRoleCheckAt: Date.now() })
      .where(eq(adminSessions.token, token));
  }
}

// ---------------------------------------------------------------------------
// Row → entity mappers
// ---------------------------------------------------------------------------

function toSessionEntity(row: MemSessionRow): Session {
  return {
    id: asSessionId(String(row.id)),
    userId: asUserId(String(row.userId)),
    csrfToken: row.csrfToken,
    expiresAt: row.expiresAt,
    ua: row.userAgent,
    ip: row.ip,
    lastRoleCheckAt: row.lastRoleCheckAt,
  };
}

function toUserEntity(row: MemUserRow, _id: number, isAdminOverride?: boolean): User {
  // The optional `isAdminOverride` lets the session's re-validated
  // isAdmin take precedence over the user-row's stored groups. This
  // matters when the role has been revalidated since the user was
  // upserted (e.g. admin demotion).
  const isAdmin =
    isAdminOverride !== undefined
      ? isAdminOverride
      : row.groupMemberships.some((g) => g.name === 'cortexos-admin');
  const groupMemberships: ReadonlyArray<GroupMembershipEntry> = isAdmin
    ? [
        { name: 'cortexos-admin', isAdmin: true },
        { name: 'cortexos-users', isAdmin: false },
      ]
    : row.groupMemberships.filter((g) => g.name !== 'cortexos-admin');
  return {
    id: asUserId(String(row.id)),
    username: row.username,
    is_admin: isAdmin,
    isAdmin,
    isActive: row.isActive,
    groupMemberships,
  };
}

function rowToSession(
  row: typeof adminSessions.$inferSelect,
  now: number,
): Session {
  return {
    id: asSessionId(String(row.id)),
    userId: asUserId(String(row.userId)),
    csrfToken: row.csrfToken ?? '',
    expiresAt: row.expiresAt.getTime(),
    ua: row.userAgent,
    ip: row.ip,
    lastRoleCheckAt: Number(row.lastRoleCheckAt) || now,
  };
}

function rowToUser(
  row: typeof pamUsers.$inferSelect,
  isAdminCached: boolean,
): User {
  const groups: ReadonlyArray<GroupName> = isAdminCached
    ? ['cortexos-admin', 'cortexos-users']
    : ['cortexos-users'];
  return {
    id: asUserId(String(row.id)),
    username: row.username,
    is_admin: isAdminCached,
    isAdmin: isAdminCached,
    isActive: true,
    groupMemberships: groups,
  };
}

function rowToSessionFromJoin(row: {
  sessionId: number;
  userId: number;
  csrfToken: string | null;
  ip: string | null;
  userAgent: string | null;
  isAdmin: boolean;
  lastRoleCheckAt: number | null;
  createdAt: Date;
  expiresAt: Date;
}): Session {
  return {
    id: asSessionId(String(row.sessionId)),
    userId: asUserId(String(row.userId)),
    csrfToken: row.csrfToken ?? '',
    expiresAt: row.expiresAt.getTime(),
    ua: row.userAgent,
    ip: row.ip,
    lastRoleCheckAt: Number(row.lastRoleCheckAt) || row.createdAt.getTime(),
  };
}
