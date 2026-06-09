// @vitest-environment node
/**
 * /audit (list page) — +page.server.ts filter logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import type { PGlite } from '@electric-sql/pglite';
import { appendAuditLog } from '$lib/server/db/repos/audit';

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

function makeReq(url: string) {
	return {
		request: new Request(url),
		url: new URL(url),
		params: {},
		route: { id: null },
		locals: {},
		cookies: { get: () => undefined },
		getClientAddress: () => '127.0.0.1',
	} as unknown as Parameters<typeof load>[0];
}

/** Shape of the page-server's return value. */
type ListPageData = {
	events: Array<{ action: string; actorUserId: string | null; surface: string; result: string }>;
	filters: {
		actor: string;
		surface: string;
		action: string;
		result: 'success' | 'failure' | 'denied' | 'error' | null;
		since: string | null;
		until: string | null;
	};
	surfaces: string[];
	actions: string[];
	exportUrl: string;
};

async function pageLoad(event: any): Promise<ListPageData> {
	return (await load(event)) as unknown as ListPageData;
}

async function seed() {
	await appendAuditLog(db, {
		eventType: 'auth.login',
		source: 'auth',
		actor: 'alice',
		payload: { a: 1 },
	});
	await appendAuditLog(db, {
		eventType: 'services.list',
		source: 'services',
		actor: 'bob',
		payload: { b: 2 },
	});
	await appendAuditLog(db, {
		eventType: 'auth.logout',
		source: 'auth',
		actor: 'alice',
		payload: { c: 3 },
	});
}

describe('audit list page loader', () => {
	beforeEach(async () => {
		await seed();
	});

	it('returns all events when no filters are set', async () => {
		const data = await pageLoad(makeReq('http://localhost/audit'));
		expect(data.events.length).toBe(3);
		// Most recent first.
		expect(data.events[0]!.action).toBe('auth.logout');
		expect(data.events[2]!.action).toBe('auth.login');
	});

	it('builds the union of surfaces and actions across the chain', async () => {
		const data = await pageLoad(makeReq('http://localhost/audit'));
		expect(data.surfaces.sort()).toEqual(['auth', 'services']);
		expect(data.actions.sort()).toEqual(['auth.login', 'auth.logout', 'services.list']);
	});

	it('builds the export URL preserving the query string', async () => {
		const data = await pageLoad(
			makeReq('http://localhost/audit?actor=alice&result=success'),
		);
		expect(data.exportUrl).toBe('/audit/export?actor=alice&result=success');
	});

	it('filters by ?actor= substring match', async () => {
		const data = await pageLoad(makeReq('http://localhost/audit?actor=alice'));
		expect(data.events.length).toBe(2);
		for (const e of data.events) {
			expect(e.actorUserId).toBe('alice');
		}
		expect(data.filters.actor).toBe('alice');
	});

	it('filters by ?surface= exact match', async () => {
		const data = await pageLoad(makeReq('http://localhost/audit?surface=auth'));
		expect(data.events.length).toBe(2);
	});

	it('filters by ?action= exact match', async () => {
		const data = await pageLoad(makeReq('http://localhost/audit?action=services.list'));
		expect(data.events.length).toBe(1);
		expect(data.events[0]!.action).toBe('services.list');
	});

	it('filters by ?result=enum', async () => {
		const data = await pageLoad(makeReq('http://localhost/audit?result=denied'));
		// audit_log does not store result; all rows default to 'success'
		expect(data.events.length).toBe(0);
	});

	it('rejects an invalid ?since= value with 400', async () => {
		const p = pageLoad(makeReq('http://localhost/audit?since=not-a-date'));
		await expect(p).rejects.toMatchObject({ status: 400 });
	});

	it('rejects an invalid ?until= value with 400', async () => {
		const p = pageLoad(makeReq('http://localhost/audit?until=garbage'));
		await expect(p).rejects.toMatchObject({ status: 400 });
	});
});
