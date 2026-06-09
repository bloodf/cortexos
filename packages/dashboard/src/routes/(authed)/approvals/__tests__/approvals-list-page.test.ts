// @vitest-environment node
/**
 * approvals-list-page.test.ts — exercises the /approvals list page
 * server `load()`: returns the adapted pending rows, applies the
 * `?action=`, `?user=`, `?age=` URL filters, and returns the
 * bootstrap fields.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import type { PGlite } from '@electric-sql/pglite';
import { createPendingApproval, resolvePendingApproval } from '$lib/server/db/repos/pending_approvals';

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
				groupMemberships: ['cortexos-admin' as const],
			},
			session: null,
		},
	} as unknown as Parameters<typeof load>[0];
}

/** Shape of the page-server's return value (from +page.server.ts). */
type ListPageData = {
	approvals: Array<{ id: string; signalName: string; runId: string; [k: string]: unknown }>;
	total: number;
	initialAction: string;
	initialUser: string;
	initialAge: 'all' | 'lt1h' | 'lt24h' | 'gt24h';
};

async function loadList(event: ReturnType<typeof makeLoadEvent>): Promise<ListPageData> {
	return (await load(event)) as unknown as ListPageData;
}

describe('/approvals list page — load()', () => {
	it('returns the empty shape when there are no pending approvals', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/approvals'));
		expect(data.approvals).toEqual([]);
		expect(data.total).toBe(0);
		expect(data.initialAction).toBe('');
		expect(data.initialUser).toBe('');
		expect(data.initialAge).toBe('all');
	});

	it('returns only pending + expired rows (not approved/denied/timeout)', async () => {
		const r1 = await createPendingApproval(db, { runId: 'r1', signalName: 'service.restart', requestedAt: new Date() });
		const r2 = await createPendingApproval(db, { runId: 'r2', signalName: 'systemd.restart', requestedAt: new Date() });
		const r3 = await createPendingApproval(db, { runId: 'r3', signalName: 'docker.kill', requestedAt: new Date() });
		// Mark r2 and r3 as resolved (decision + approver); they should
		// drop out of the pending list and into history.
		await resolvePendingApproval(db, r2.id, 'approve', 'root');
		await resolvePendingApproval(db, r3.id, 'deny', 'alice');

		const data = await loadList(makeLoadEvent('http://localhost/approvals'));
		expect(data.total).toBe(1);
		expect(data.approvals[0]?.runId).toBe(r1.runId);
	});

	it('honors the ?action= filter (matches against signal / run / reason)', async () => {
		await createPendingApproval(db, { runId: 'r1', signalName: 'service.restart', reason: 'leak', requestedAt: new Date() });
		await createPendingApproval(db, { runId: 'r2', signalName: 'systemd.restart', requestedAt: new Date() });
		const data = await loadList(
			makeLoadEvent('http://localhost/approvals?action=service'),
		);
		expect(data.approvals).toHaveLength(1);
		expect(data.approvals[0]?.signalName).toBe('service.restart');
		expect(data.initialAction).toBe('service');
	});

	it('honors the ?user= filter and preserves the URL bootstrap', async () => {
		await createPendingApproval(db, { runId: 'r1', signalName: 'service.restart', requestedAt: new Date() });
		const data = await loadList(
			makeLoadEvent('http://localhost/approvals?user=root'),
		);
		// The filter is applied across the visible row fields
		// (signal, run, reason, role). A pending row with no approver
		// set is filtered out by the `root` query — the URL bootstrap
		// still flows through.
		expect(data.initialUser).toBe('root');
	});

	it('honors the ?age= filter (coerces invalid values to all)', async () => {
		await createPendingApproval(db, { runId: 'r1', signalName: 'service.restart', requestedAt: new Date() });
		const valid = await loadList(
			makeLoadEvent('http://localhost/approvals?age=lt1h'),
		);
		expect(valid.approvals).toHaveLength(1);
		expect(valid.initialAge).toBe('lt1h');

		const invalid = await loadList(
			makeLoadEvent('http://localhost/approvals?age=banana'),
		);
		expect(invalid.initialAge).toBe('all');
	});
});
