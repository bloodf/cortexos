// @vitest-environment node
/**
 * approvals-list-page-extra.test.ts — extra branches for the
 * (authed)/approvals/+page.server.ts load().
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import type { PGlite } from '@electric-sql/pglite';
import { createPendingApproval } from '$lib/server/db/repos/pending_approvals';

let db: PgliteDbClient;
let client: PGlite;
let load: typeof import('../+page.server').load;

vi.mock('$lib/server/db/client', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db/client')>('$lib/server/db/client');
	return {
		...actual,
		getDb: () => db,
	};
});

beforeEach(async () => {
	const r = await createTestDb({ seed: true });
	db = r.db;
	client = r.client;
	const mod = await import('../+page.server');
	load = mod.load;
}, 30_000);

afterEach(async () => {
	if (client) await client.close();
	vi.resetModules();
});

function makeLoadEvent(url: string, params: Record<string, string> = {}) {
	const u = new URL(url, 'http://localhost/');
	return {
		url: u,
		params,
		locals: {
			user: {
				id: 'u1' as never,
				username: 'root',
				isAdmin: true,
				isActive: true,
				groupMemberships: [{ name: 'cortexos-admin', isAdmin: true }],
			},
			session: null,
		},
	} as unknown as Parameters<typeof load>[0];
}

describe('(authed)/approvals — auth gate branches', () => {
	it('throws 401 when locals.user is null', async () => {
		const event = {
			url: new URL('http://localhost/approvals'),
			params: {},
			locals: { user: null, session: null },
		} as unknown as Parameters<typeof load>[0];
		await expect(load(event)).rejects.toMatchObject({ status: 401 });
	});

	it('throws 403 when locals.user is a non-admin (no cortexos-admin group)', async () => {
		const event = {
			url: new URL('http://localhost/approvals'),
			params: {},
			locals: {
				user: {
					id: 'u1' as never,
					username: 'bob',
					isAdmin: false,
					isActive: true,
					groupMemberships: [{ name: 'cortexos-users', isAdmin: false }],
				},
				session: null,
			},
		} as unknown as Parameters<typeof load>[0];
		await expect(load(event)).rejects.toMatchObject({ status: 403 });
	});

	it('coerces an invalid age bucket to all', async () => {
		await createPendingApproval(db, { runId: 'r1', signalName: 'service.restart', requestedAt: new Date() });
		const data = await load(
			makeLoadEvent('http://localhost/approvals?age=invalid-bucket'),
		) as unknown as { initialAge: string };
		expect(data.initialAge).toBe('all');
	});

	it('returns initialAction + initialUser when both filters are set', async () => {
		await createPendingApproval(db, { runId: 'r1', signalName: 'service.restart', requestedAt: new Date() });
		const data = await load(
			makeLoadEvent('http://localhost/approvals?action=service&user=root'),
		) as unknown as { initialAction: string; initialUser: string; initialAge: string };
		expect(data.initialAction).toBe('service');
		expect(data.initialUser).toBe('root');
		expect(data.initialAge).toBe('all');
	});

	it('accepts the cortexos-admin group even when isAdmin is false', async () => {
		const event = {
			url: new URL('http://localhost/approvals'),
			params: {},
			locals: {
				user: {
					id: 'u1' as never,
					username: 'root',
					isAdmin: false,
					isActive: true,
					groupMemberships: [{ name: 'cortexos-admin', isAdmin: true }],
				},
				session: null,
			},
		} as unknown as Parameters<typeof load>[0];
		const data = await load(event) as unknown as { approvals: unknown[] };
		expect(data.approvals).toEqual([]);
	});
});
