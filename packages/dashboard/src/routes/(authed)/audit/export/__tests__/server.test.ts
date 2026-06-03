/**
 * /audit/export/+server.ts — CSV format + Content-Disposition.
 *
 * The endpoint is admin-gated by the (authed)/audit +layout.server.ts
 * (requireAdmin). These tests call the handler directly with a fake
 * RequestEvent (the layout gate is exercised by the page tests).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET as exportGet } from '../+server';
import { resetAudit, audit } from '$lib/server/audit';
import { asUserId, asSessionId } from '$lib/server/entities';
import type { RequestEvent } from '@sveltejs/kit';

// The export handler is tightly typed to a specific route. Cast at the
// test boundary so the fake event can drive it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function GET(event: any): Promise<Response> {
	return (await exportGet(event)) as Response;
}

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

describe('audit export CSV', () => {
	beforeEach(() => {
		resetAudit();
	});

	it('returns text/csv with a timestamped Content-Disposition filename', async () => {
		makeEvent();
		const res = await GET(makeReq('http://localhost/audit/export') as never);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toMatch(/^text\/csv/);
		const cd = res.headers.get('content-disposition') ?? '';
		expect(cd).toMatch(/^attachment; filename="cortexos-audit-/);
		expect(cd).toMatch(/\.csv"$/);
	});

	it('emits a header row', async () => {
		makeEvent();
		const res = await GET(makeReq('http://localhost/audit/export') as never);
		const body = await res.text();
		const firstLine = body.split(/\r?\n/)[0]!;
		expect(firstLine.split(',')[0]).toBe('id');
		expect(firstLine).toContain('created_at');
		expect(firstLine).toContain('payload_json');
	});

	it('emits one row per event, most recent first', async () => {
		makeEvent();
		makeEvent2();
		const res = await GET(makeReq('http://localhost/audit/export') as never);
		const body = await res.text();
		const lines = body.trim().split(/\r?\n/);
		// 1 header + 2 data rows
		expect(lines.length).toBe(3);
		// The most recent event is bob/services, which should be first.
		expect(lines[1]).toContain('services.list');
		expect(lines[1]).toContain('bob');
		expect(lines[2]).toContain('auth.login');
	});

	it('honors the ?result=failure filter', async () => {
		makeEvent();
		makeEvent2();
		const res = await GET(makeReq('http://localhost/audit/export?result=failure') as never);
		const body = await res.text();
		const lines = body.trim().split(/\r?\n/);
		expect(lines.length).toBe(2); // header + 1 row
		expect(lines[1]).toContain('services.list');
	});

	it('honors the ?actor=bob filter (substring on actorUserId)', async () => {
		makeEvent();
		makeEvent2();
		const res = await GET(makeReq('http://localhost/audit/export?actor=bob') as never);
		const body = await res.text();
		const lines = body.trim().split(/\r?\n/);
		expect(lines.length).toBe(2);
		expect(lines[1]).toContain('bob');
	});

	it('escapes commas in payload via JSON encoding', async () => {
		makeEvent2();
		const res = await GET(makeReq('http://localhost/audit/export') as never);
		const body = await res.text();
		// The nested "v,with,commas" is JSON-encoded; the CSV row stays
		// single-line (no embedded newline from the payload). CSV escaping
		// doubles the surrounding quotes, hence ""…"" in the row.
		const dataLines = body.trim().split(/\r?\n/).slice(1);
		expect(dataLines.length).toBe(1);
		expect(dataLines[0]).toContain('""k"":""v,with,commas""');
	});

	it('rejects an invalid `since` with 400', async () => {
		const res = GET(makeReq('http://localhost/audit/export?since=not-a-date') as never);
		await expect(res).rejects.toMatchObject({ status: 400 });
	});

	it('rejects an invalid `result` value silently (returns all rows)', async () => {
		makeEvent();
		const res = await GET(makeReq('http://localhost/audit/export?result=garbage') as never);
		expect(res.status).toBe(200);
		const body = await res.text();
		const lines = body.trim().split(/\r?\n/);
		// header + the one event
		expect(lines.length).toBe(2);
	});
});
