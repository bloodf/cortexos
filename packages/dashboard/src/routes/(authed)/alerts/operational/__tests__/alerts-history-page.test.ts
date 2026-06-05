/**
 * alerts-history-page.test.ts — exercises the /alerts/history page
 * server `load()`: returns the most recent firings and honors the
 * `?ruleId=` and `?serviceId=` URL filters.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import { load as historyLoad } from '../../history/+page.server';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import type { AlertEvent } from '@cortexos/contracts';

let pgdb: PgliteDbClient;
let pgClient: import('@electric-sql/pglite').PGlite;
let serviceId: number;

vi.mock('$lib/server/db/client', () => ({
	getDb: () => pgdb,
	db: new Proxy({} as PgliteDbClient, { get: (_t, p, r) => Reflect.get(pgdb, p, r) }),
}));

const fakeUser = {
	id: 'user_op',
	username: 'op',
	isAdmin: false,
	isActive: true,
	groupMemberships: ['cortexos-users' as const],
};

function makeLoadEvent(url: string): Parameters<typeof historyLoad>[0] {
	return {
		url: new URL(url, 'http://localhost/'),
		params: {},
		locals: { user: fakeUser, session: null },
		 
	} as any;
}

type HistoryPageData = {
	events: AlertEvent[];
	filters: { ruleId: number | null; serviceId: number | null };
};

async function loadHistory(event: Parameters<typeof historyLoad>[0]): Promise<HistoryPageData> {
	return (await historyLoad(event)) as unknown as HistoryPageData;
}

beforeEach(async () => {
	const r = await createTestDb();
	pgdb = r.db;
	pgClient = r.client;
	const { services } = await import('$lib/server/db/schema');
	const svc = await pgdb.select().from(services).limit(1);
	serviceId = svc[0]!.id;
	vi.resetModules();
}, 30_000);

describe('/alerts/history page — load()', () => {
	it('returns an empty list when there are no firings', async () => {
		const data = await loadHistory(makeLoadEvent('http://localhost/alerts/history'));
		expect(data.events).toEqual([]);
		expect(data.filters.ruleId).toBeNull();
		expect(data.filters.serviceId).toBeNull();
	});

	it('returns adapted firings and the ruleId/serviceId filter state', async () => {
		const rule = await alertsRepo.createAlertRule(pgdb, {
			serviceId,
			name: 'history rule',
			condition: 'offline',
			thresholdMs: null,
			enabled: true,
		});
		await alertsRepo.insertAlertHistory(pgdb, {
			ruleId: rule.id,
			serviceId,
			status: 'fired',
			message: 'm1',
		});
		const data = await loadHistory(
			makeLoadEvent(`http://localhost/alerts/history?ruleId=${rule.id}`),
		);
		expect(data.events.length).toBe(1);
		expect(data.events[0]?.message).toBe('m1');
		expect(data.filters.ruleId).toBe(rule.id);
	});

	it('ignores a non-numeric ruleId', async () => {
		const data = await loadHistory(
			makeLoadEvent('http://localhost/alerts/history?ruleId=not-a-number'),
		);
		expect(data.filters.ruleId).toBeNull();
	});

	it('ignores a non-numeric serviceId', async () => {
		const data = await loadHistory(
			makeLoadEvent('http://localhost/alerts/history?serviceId=abc'),
		);
		expect(data.filters.serviceId).toBeNull();
	});
});
