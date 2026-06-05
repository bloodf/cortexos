/**
 * contracts-bridge.ts — convert the auth module's local User/Session
 * (snake_case fields, string-union group memberships, integer IDs,
 * lastRoleCheckAt) into the @cortexos/contracts User/Session (UUID IDs,
 * object GroupMembership, lastRoleCheck) for App.Locals.
 *
 * The reverse direction (contracts → local) is not needed: the contracts
 * type is the wire format for clients; the local type is the runtime
 * type used inside hooks/auth/session-store.
 */
import type { User as ContractUser, Session as ContractSession, GroupMembership } from '@cortexos/contracts';
import type { User as LocalUser, Session as LocalSession, GroupName } from './entities';

/**
 * Convert a local auth User to the contracts User shape.
 *
 * The contracts type requires UUIDs (`zUuidV4`) and a few derived
 * fields (createdAt, lastLoginAt, activeSessions, status) that the
 * local auth store does not persist. We derive sensible defaults:
 *
 *   - id:           the local pam_users.id (integer) is prefixed with
 *                   a stable namespace so the result is a valid UUIDv4
 *                   string. This is good enough for in-process identity
 *                   but should NOT be sent to external systems.
 *   - createdAt:    best-effort — we don't persist it, so use
 *                   `new Date(0).toISOString()`.
 *   - lastLoginAt:  null (the auth store doesn't track this).
 *   - activeSessions: derived from the resolved session count (1
 *                    when we just resolved one).
 *   - status:       'active' (suspended/disabled states are future work).
 *   - groupMemberships: expanded from the local string union into the
 *                    contracts object shape with isAdmin per group.
 */
export function toContractsUser(local: LocalUser, activeSessions = 1): ContractUser {
  return {
    id: asUuidLike(local.id),
    username: local.username,
    isAdmin: local.isAdmin,
    isActive: local.isActive,
    status: 'active',
    groupMemberships: expandGroups(local.groupMemberships, local.isAdmin),
    createdAt: new Date(0).toISOString(),
    lastLoginAt: null,
    activeSessions,
  };
}

/**
 * Convert a local auth Session to the contracts Session shape.
 *
 * The contracts Session requires createdAt/lastSeenAt (ISO strings)
 * and cookieToken (the cookie value, distinct from the DB token).
 * The local auth Session carries expiresAt (epoch ms) and the
 * cookie-bound token via `csrfToken` (the CSRF cookie is paired
 * with the session token in our login flow). lastSeenAt mirrors
 * lastRoleCheckAt; that's a conservative read of the most recent
 * server-side touch.
 */
export function toContractsSession(local: LocalSession): ContractSession {
  return {
    id: asUuidLike(local.id),
    userId: asUuidLike(local.userId),
    csrfToken: local.csrfToken,
    cookieToken: local.csrfToken, // same value; login sets both cookies together
    expiresAt: new Date(local.expiresAt).toISOString(),
    createdAt: new Date(local.expiresAt - DEFAULT_SESSION_TTL_MS).toISOString(),
    lastSeenAt: new Date(local.lastRoleCheckAt).toISOString(),
    ip: local.ip,
    userAgent: local.ua,
    isAdmin: false, // resolved at user level; see toContractsUser
    lastRoleCheck: local.lastRoleCheckAt,
  };
}

/** 30 days — matches DEFAULT_SESSION_TTL_MS in auth/session-store.ts. */
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Known group descriptions, used to populate the optional `description`
 *  field on the contracts GroupMembership. */
const GROUP_DESCRIPTIONS: Readonly<Record<GroupName, string>> = {
  'cortexos-admin': 'Dashboard administrator group (per SR-003).',
  'cortexos-auditor': 'Read-only auditor group.',
  'cortexos-users': 'Standard dashboard users.',
};

function expandGroups(
  groups: ReadonlyArray<GroupName | { name: GroupName; isAdmin: boolean }>,
  userIsAdmin: boolean,
): GroupMembership[] {
  return groups.map((g) => {
    const name = typeof g === 'string' ? g : g.name;
    return {
      name,
      description: GROUP_DESCRIPTIONS[name],
      isAdmin: userIsAdmin && name === 'cortexos-admin',
    };
  });
}

/**
 * Derive a stable UUID-shaped string from the local branded ID.
 * The local pam_users.id is an integer; we wrap it in a deterministic
 * UUID namespace so the result satisfies the `zUuidV4` schema check
 * for in-process identity (the contracts type enforces UUID).
 *
 * Important: this is NOT a globally-unique UUID. The dashboard's
 * contracts User is a wire-format type for the SvelteKit handlers;
 * downstream clients should treat the id as opaque.
 */
function asUuidLike(id: string): string {
  // Strip the brand suffix (if any) and coerce to integer when possible.
  const raw = String(id);
  let n: number;
  if (/^\d+$/.test(raw)) {
    n = Number.parseInt(raw, 10);
  } else {
    // Hash the string for non-integer branded ids (e.g. test ids).
    let h = 0;
    for (let i = 0; i < raw.length; i++) {
      h = (h * 31 + raw.charCodeAt(i)) >>> 0;
    }
    n = h;
  }
  // Build a deterministic v4-shaped UUID from the integer.
  const hex = (n >>> 0).toString(16).padStart(8, '0');
  const tail = ((n * 2654435761) >>> 0).toString(16).padStart(8, '0');
  return `00000000-0000-4000-8000-${hex}${tail}`.slice(0, 36);
}
