/**
 * /audit/[id] (detail page) — prev/next navigation + chain link.
 *
 * The chain link is sourced from the Drizzle `verifyAuditLogChain(db)`
 * in src/lib/server/db/repos/audit.ts. We mock that module to return
 * a known result so the test stays decoupled from the DB layer
 * (the Drizzle repo has its own dedicated test suite).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as auditRepo from '$lib/server/db/repos/audit';

const verifyMock = vi.spyOn(auditRepo, 'verifyAuditLogChain');
verifyMock.mockResolvedValue({
	valid: true as const,
	count: 3,
	firstId: 1,
	lastId: 3,
});

import { load as pageLoad } from '../+page.server';
import { resetAudit, audit } from '$lib/server/audit';
import { asUserId, asAuditEventId } from '$lib/server/entities';
import type { AuditEvent, AuditEventId } from '$lib/server/entities';
import type { RequestEvent } from '@sveltejs/kit';

function makeReq(url: string, params: Record<string, string>): RequestEvent {
	return {
		request: new Request(url),
		url: new URL(url),
		params,
		route: { id: null },
		locals: {},
		cookies: { get: () => undefined },
		getClientAddress: () => '127.0.0.1',
	} as unknown as RequestEvent;
}

/** Shape of the detail page-server's return value. */
type DetailPageData = {
	event: AuditEvent;
	prevId: AuditEventId | null;
	nextId: AuditEventId | null;
	chainLink: { ok: true; length: number } | { ok: false; index: number; reason: string };
};

// The page load is tightly typed to a specific route; cast at the test
// boundary so the fake event can drive it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function load(event: any): Promise<DetailPageData> {
	return (await pageLoad(event)) as unknown as DetailPageData;
}

function seed(): { oldest: string; middle: string; newest: string } {
	const ids: string[] = [];
	for (let i = 0; i < 3; i++) {
		const ev = audit({
			actorUserId: asUserId(`u${i}`),
			actorSessionId: null,
			actorIp: null,
			actorUserAgent: null,
			surface: 'auth',
			action: `auth.step${i}`,
			target: null,
			result: 'success',
			errorCode: null,
			payload: { i },
		});
		ids.push(ev.id);
	}
	const [oldest, middle, newest] = ids as [string, string, string];
	return { oldest, middle, newest };
}

describe('audit detail page loader', () => {
	beforeEach(() => {
		resetAudit();
		verifyMock.mockReset();
		verifyMock.mockResolvedValue({
			valid: true as const,
			count: 3,
			firstId: 1,
			lastId: 3,
		});
	});

	it('throws 404 for an unknown id', async () => {
		const unknownId = '00000000-0000-4000-8000-000000000999';
		const p = load(
			makeReq(`http://localhost/audit/${unknownId}`, { id: unknownId }),
		);
		await expect(p).rejects.toMatchObject({ status: 404 });
	});

	it('returns the oldest event with no prev and the next (newer) id', async () => {
		const { oldest, middle, newest } = seed();
		const data = await load(
			makeReq(`http://localhost/audit/${oldest}`, { id: oldest }),
		);
		expect(data.event.id).toBe(oldest);
		expect(data.prevId).toBeNull();
		// Storage order: [oldest, middle, newest]; the next-older is `middle`.
		expect(data.nextId).toBe(middle);
		void newest;
	});

	it('returns both prev and next for a middle row', async () => {
		const { oldest, middle, newest } = seed();
		const data = await load(
			makeReq(`http://localhost/audit/${middle}`, { id: middle }),
		);
		expect(data.event.id).toBe(middle);
		// Storage order: [oldest, middle, newest]
		expect(data.prevId).toBe(oldest);
		expect(data.nextId).toBe(newest);
	});

	it('returns a prev (older) and no next for the newest event', async () => {
		const { oldest, middle, newest } = seed();
		const data = await load(
			makeReq(`http://localhost/audit/${newest}`, { id: newest }),
		);
		expect(data.event.id).toBe(newest);
		expect(data.prevId).toBe(middle);
		expect(data.nextId).toBeNull();
		void oldest;
	});

	it('surfaces a valid chain link from verifyAuditLogChain (Drizzle)', async () => {
		const { oldest } = seed();
		const data = await load(
			makeReq(`http://localhost/audit/${oldest}`, { id: oldest }),
		);
		// Mock returns { valid: true, count: 3, firstId: 1, lastId: 3 }.
		expect(data.chainLink.ok).toBe(true);
		if (data.chainLink.ok) {
			expect(data.chainLink.length).toBe(3);
		}
	});

	it('surfaces a broken chain link when verifyAuditLogChain reports a break', async () => {
		verifyMock.mockResolvedValueOnce({
			valid: false as const,
			count: 5,
			brokenAt: {
				id: 2,
				occurredAt: new Date('2026-06-03T00:00:00Z'),
				reason: 'prev_hash_mismatch',
			},
		});
		const { oldest } = seed();
		const data = await load(
			makeReq(`http://localhost/audit/${oldest}`, { id: oldest }),
		);
		expect(data.chainLink.ok).toBe(false);
		if (!data.chainLink.ok) {
			expect(data.chainLink.index).toBe(2);
			expect(data.chainLink.reason).toBe('prev_hash_mismatch');
		}
	});
});
