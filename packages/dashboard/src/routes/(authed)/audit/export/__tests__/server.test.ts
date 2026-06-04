/**
 * /audit/export/+server.ts — CSV format + Content-Disposition +
 * admin auth gate.
 *
 * Critical: SvelteKit 2.20 `+layout.server.ts` does NOT cover
 * `+server.ts` endpoints in the same route group. The export handler
 * enforces admin access inline (checks `event.locals.user` and throws
 * SvelteKit's `error(401|403, ...)` if not). This test covers the
 * gate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET as exportGet } from '../+server';
import { resetAudit, audit } from '$lib/server/audit';
import { asUserId, asSessionId } from '$lib/server/entities';
import type { RequestEvent } from '@sveltejs/kit';

function makeEvent(over: Partial<Parameters<typeof audit>[0]> = {}): void {
	audit({
		actorUserId: asUserId('alice'),
		actorSessionId: asSessionId('s-1'),
		actorIp: '127.0.0.1',
		actorUserAgent: 'jest',
		surface: 'auth',
		action: 'auth.login',
		target: null,
		result: 'success',
		errorCode: null,
		payload: { foo: 'bar' },
		...over,
	});
}

function makeEvent2(): void {
	audit({
		actorUserId: asUserId('bob'),
		actorSessionId: null,
		actorIp: '10.0.0.2',
		actorUserAgent: null,
		surface: 'services',
		action: 'services.list',
		target: 'svc1',
		result: 'failure',
		errorCode: 'EACCES',
		payload: { nested: { k: 'v,with,commas' } },
	});
}

function makeReq(url: string, localsUser: unknown = null): RequestEvent {
	return {
		request: new Request(url),
		url: new URL(url),
		params: {},
		route: { id: null },
		locals: { user: localsUser },
		cookies: { get: () => undefined },
		getClientAddress: () => '127.0.0.1',
	} as unknown as RequestEvent;
}

const adminUser = {
	id: asUserId('admin-1'),
	username: 'admin',
	isAdmin: true,
	isActive: true,
	groupMemberships: ['cortexos-admin'],
};

const standardUser = {
	id: asUserId('user-1'),
	username: 'alice',
	isAdmin: false,
	isActive: true,
	groupMemberships: [],
};

// The export handler is tightly typed to a specific route. Cast at the
// test boundary so the fake event can drive it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function GET(event: any): Promise<Response> {
	return (await exportGet(event)) as Response;
}

describe('audit export CSV — admin auth gate', () => {
	beforeEach(() => {
		resetAudit();
	});

	it('returns 401 for an anonymous request (no session cookie)', async () => {
		makeEvent();
		// locals.user is null when no session cookie is present.
		const p = GET(makeReq('http://localhost/audit/export', null));
		await expect(p).rejects.toMatchObject({ status: 401 });
	});

	it('returns 403 for an authenticated non-admin user', async () => {
		makeEvent();
		const p = GET(makeReq('http://localhost/audit/export', standardUser));
		await expect(p).rejects.toMatchObject({ status: 403 });
	});

	it('does not produce CSV output when the gate rejects (status != 200)', async () => {
		makeEvent();
		const p = GET(makeReq('http://localhost/audit/export', null));
		await expect(p).rejects.toMatchObject({ status: 401 });
	});
});

describe('audit export CSV — happy path (admin allowed)', () => {
	beforeEach(() => {
		resetAudit();
	});

	it('returns text/csv with a timestamped Content-Disposition filename', async () => {
		makeEvent();
		const res = await GET(makeReq('http://localhost/audit/export', adminUser));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toMatch(/^text\/csv/);
		const cd = res.headers.get('content-disposition') ?? '';
		expect(cd).toMatch(/^attachment; filename="cortexos-audit-/);
		expect(cd).toMatch(/\.csv"$/);
	});

	it('emits a header row', async () => {
		makeEvent();
		const res = await GET(makeReq('http://localhost/audit/export', adminUser));
		const body = await res.text();
		const firstLine = body.split(/\r?\n/)[0]!;
		expect(firstLine.split(',')[0]).toBe('id');
		expect(firstLine).toContain('created_at');
		expect(firstLine).toContain('payload_json');
	});

	it('emits one row per event, most recent first', async () => {
		makeEvent();
		makeEvent2();
		const res = await GET(makeReq('http://localhost/audit/export', adminUser));
		const body = await res.text();
		const lines = body.trim().split(/\r?\n/);
		expect(lines.length).toBe(3); // header + 2 data rows
		expect(lines[1]).toContain('services.list');
		expect(lines[1]).toContain('bob');
		expect(lines[2]).toContain('auth.login');
	});

	it('honors the ?result=failure filter', async () => {
		makeEvent();
		makeEvent2();
		const res = await GET(
			makeReq('http://localhost/audit/export?result=failure', adminUser),
		);
		const body = await res.text();
		const lines = body.trim().split(/\r?\n/);
		expect(lines.length).toBe(2); // header + 1 row
		expect(lines[1]).toContain('services.list');
	});

	it('honors the ?actor=bob filter (substring on actorUserId)', async () => {
		makeEvent();
		makeEvent2();
		const res = await GET(makeReq('http://localhost/audit/export?actor=bob', adminUser));
		const body = await res.text();
		const lines = body.trim().split(/\r?\n/);
		expect(lines.length).toBe(2);
		expect(lines[1]).toContain('bob');
	});

	it('escapes commas in payload via JSON encoding', async () => {
		makeEvent2();
		const res = await GET(makeReq('http://localhost/audit/export', adminUser));
		const body = await res.text();
		const dataLines = body.trim().split(/\r?\n/).slice(1);
		expect(dataLines.length).toBe(1);
		// CSV escaping doubles the surrounding quotes, hence ""…"" in the row.
		expect(dataLines[0]).toContain('""k"":""v,with,commas""');
	});

	it('rejects an invalid `since` with 400', async () => {
		const res = GET(
			makeReq('http://localhost/audit/export?since=not-a-date', adminUser),
		);
		await expect(res).rejects.toMatchObject({ status: 400 });
	});

	it('rejects an invalid `result` value silently (returns all rows)', async () => {
		makeEvent();
		const res = await GET(
			makeReq('http://localhost/audit/export?result=garbage', adminUser),
		);
		expect(res.status).toBe(200);
		const body = await res.text();
		const lines = body.trim().split(/\r?\n/);
		expect(lines.length).toBe(2); // header + the one event
	});
});
