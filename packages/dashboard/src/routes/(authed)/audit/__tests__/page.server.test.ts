/**
 * /audit (list page) — +page.server.ts filter logic.
 *
 * The page is admin-gated by the (authed)/audit +layout.server.ts. We
 * exercise the load function directly with a fake RequestEvent to
 * test the filter parsing + event filtering, independent of the
 * auth gate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { load as pageLoad } from '../+page.server';
import { resetAudit, audit } from '$lib/server/audit';
import { asUserId, asSessionId } from '$lib/server/entities';
import type { AuditEvent } from '$lib/server/entities';
import type { RequestEvent } from '@sveltejs/kit';

function makeReq(url: string): RequestEvent {
	return {
		request: new Request(url),
		url: new URL(url),
		params: {},
		route: { id: null },
		locals: {},
		cookies: { get: () => undefined },
		getClientAddress: () => '127.0.0.1',
	} as unknown as RequestEvent;
}

/** Shape of the page-server's return value. */
type ListPageData = {
	events: AuditEvent[];
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

// The page load is tightly typed to a specific route; cast at the test
// boundary so the fake event can drive it.
 
async function load(event: any): Promise<ListPageData> {
	return (await pageLoad(event)) as unknown as ListPageData;
}

function seed(): void {
	audit({
		actorUserId: asUserId('alice'),
		actorSessionId: asSessionId('s-a'),
		actorIp: null,
		actorUserAgent: null,
		surface: 'auth',
		action: 'auth.login',
		target: null,
		result: 'success',
		errorCode: null,
		payload: { a: 1 },
	});
	audit({
		actorUserId: asUserId('bob'),
		actorSessionId: null,
		actorIp: null,
		actorUserAgent: null,
		surface: 'services',
		action: 'services.list',
		target: 'svc1',
		result: 'failure',
		errorCode: 'EACCES',
		payload: { b: 2 },
	});
	audit({
		actorUserId: asUserId('alice'),
		actorSessionId: null,
		actorIp: null,
		actorUserAgent: null,
		surface: 'auth',
		action: 'auth.logout',
		target: null,
		result: 'denied',
		errorCode: null,
		payload: { c: 3 },
	});
}

describe('audit list page loader', () => {
	beforeEach(() => {
		resetAudit();
		seed();
	});

	it('returns all events when no filters are set', async () => {
		const data = await load(makeReq('http://localhost/audit') as never);
		expect(data.events.length).toBe(3);
		// Most recent first.
		expect(data.events[0]!.action).toBe('auth.logout');
		expect(data.events[2]!.action).toBe('auth.login');
	});

	it('builds the union of surfaces and actions across the chain', async () => {
		const data = await load(makeReq('http://localhost/audit') as never);
		expect(data.surfaces.sort()).toEqual(['auth', 'services']);
		expect(data.actions.sort()).toEqual(['auth.login', 'auth.logout', 'services.list']);
	});

	it('builds the export URL preserving the query string', async () => {
		const data = await load(
			makeReq('http://localhost/audit?actor=alice&result=success') as never,
		);
		expect(data.exportUrl).toBe('/audit/export?actor=alice&result=success');
	});

	it('filters by ?actor= substring match', async () => {
		const data = await load(makeReq('http://localhost/audit?actor=alice') as never);
		expect(data.events.length).toBe(2);
		for (const e of data.events) {
			expect(e.actorUserId).toBe('alice');
		}
		expect(data.filters.actor).toBe('alice');
	});

	it('filters by ?surface= exact match', async () => {
		const data = await load(makeReq('http://localhost/audit?surface=auth') as never);
		expect(data.events.length).toBe(2);
	});

	it('filters by ?action= exact match', async () => {
		const data = await load(makeReq('http://localhost/audit?action=services.list') as never);
		expect(data.events.length).toBe(1);
		expect(data.events[0]!.action).toBe('services.list');
	});

	it('filters by ?result=enum', async () => {
		const data = await load(makeReq('http://localhost/audit?result=denied') as never);
		expect(data.events.length).toBe(1);
		expect(data.events[0]!.result).toBe('denied');
	});

	it('rejects an invalid ?since= value with 400', async () => {
		const p = load(makeReq('http://localhost/audit?since=not-a-date') as never);
		await expect(p).rejects.toMatchObject({ status: 400 });
	});

	it('rejects an invalid ?until= value with 400', async () => {
		const p = load(makeReq('http://localhost/audit?until=garbage') as never);
		await expect(p).rejects.toMatchObject({ status: 400 });
	});
});
