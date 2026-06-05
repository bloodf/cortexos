/**
 * /audit/verify — chain verification report.
 *
 * The loader calls `verifyAuditLogChain(db)` from
 * src/lib/server/db/repos/audit.ts (Drizzle / TimescaleDB), then
 * maps the Drizzle VerifyChainResult shape to the M1 AuditVerifyResult
 * shape the ChainVerifyReport component consumes.
 *
 * We mock the Drizzle repo so the test stays decoupled from the DB.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as auditRepo from '$lib/server/db/repos/audit';

const verifyMock = vi.spyOn(auditRepo, 'verifyAuditLogChain');
verifyMock.mockResolvedValue({
	valid: true as const,
	count: 0,
	firstId: 0,
	lastId: 0,
});

import { load as pageLoad } from '../+page.server';
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

/** Shape of the verify page-server's return value (after shape-mapping). */
type VerifyPageData = {
	result:
		| { ok: true; length: number }
		| { ok: false; index: number; reason: string };
	length: number;
	ranAt: string;
};

 
async function load(event: any): Promise<VerifyPageData> {
	return (await pageLoad(event)) as unknown as VerifyPageData;
}

describe('audit verify page loader', () => {
	beforeEach(() => {
		verifyMock.mockReset();
		verifyMock.mockResolvedValue({
			valid: true as const,
			count: 0,
			firstId: 0,
			lastId: 0,
		});
	});

	it('returns the verifier result + a fresh ranAt timestamp', async () => {
		const data = await load(makeReq('http://localhost/audit/verify'));
		expect(data.result.ok).toBe(true);
		expect(data.length).toBe(0);
		expect(typeof data.ranAt).toBe('string');
		// ISO 8601 timestamp
		expect(() => new Date(data.ranAt).toISOString()).not.toThrow();
	});

	it('maps verifyAuditLogChain.count → page length (ok variant)', async () => {
		verifyMock.mockResolvedValueOnce({
			valid: true as const,
			count: 42,
			firstId: 1,
			lastId: 42,
		});
		const data = await load(makeReq('http://localhost/audit/verify'));
		expect(data.length).toBe(42);
		expect(data.result.ok).toBe(true);
		if (data.result.ok) {
			expect(data.result.length).toBe(42);
		}
	});

	it('maps brokenAt → { ok: false, index, reason } (broken variant)', async () => {
		verifyMock.mockResolvedValueOnce({
			valid: false as const,
			count: 9,
			brokenAt: {
				id: 7,
				occurredAt: new Date('2026-06-03T12:00:00Z'),
				reason: 'payload_hash_mismatch',
			},
		});
		const data = await load(makeReq('http://localhost/audit/verify'));
		expect(data.result.ok).toBe(false);
		expect(data.length).toBe(9);
		if (!data.result.ok) {
			expect(data.result.index).toBe(7);
			expect(data.result.reason).toBe('payload_hash_mismatch');
		}
	});
});
