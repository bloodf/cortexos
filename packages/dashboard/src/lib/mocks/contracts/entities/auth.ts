/**
 * Auth-domain entities: User, Session, PamUser.
 *
 * Aligned with the M0-A audit (groups derived from OS `cortexos-admin` /
 * `sudo`) and the M0-E threat model (PB-5: isAdmin is the only RBAC
 * check today; the matrix's auth pairs (ALLOW/DENY) drive the
 * `mock-scenarios` deny surface).
 */

import { z } from 'zod';
import { asUserId, type UserId } from '../primitives';

export const GROUP_MEMBERSHIPS = ['cortexos-admin', 'cortexos-operator', 'sudo', 'cortexos-readonly'] as const;
export type GroupMembership = (typeof GROUP_MEMBERSHIPS)[number];

export const userSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(1),
	isAdmin: z.boolean(),
	isActive: z.boolean(),
	groupMemberships: z.array(z.enum(GROUP_MEMBERSHIPS)),
	createdAt: z.string().datetime(),
	lastLoginAt: z.string().datetime().nullable(),
	email: z.string().email().nullable().optional(),
});
export type User = z.infer<typeof userSchema> & { id: UserId };

export const sessionSchema = z.object({
	id: z.string().min(1),
	userId: z.string().min(1),
	csrfToken: z.string().min(1),
	expiresAt: z.string().datetime(),
	ua: z.string(),
	ip: z.string(),
	createdAt: z.string().datetime(),
});
export type Session = z.infer<typeof sessionSchema>;

export const pamUserSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(1),
	createdAt: z.string().datetime(),
	activeSessions: z.number().int().nonnegative(),
	lastLoginAt: z.string().datetime().nullable(),
	groups: z.array(z.string()),
	isAdmin: z.boolean(),
});
export type PamUser = z.infer<typeof pamUserSchema> & { id: UserId };

/** Cast a plain `User` from a Zod parse to a branded `User`. */
export const brandUser = (u: z.infer<typeof userSchema>): User => ({ ...u, id: asUserId(u.id) });
export const brandPamUser = (u: z.infer<typeof pamUserSchema>): PamUser => ({
	...u,
	id: asUserId(u.id),
});
