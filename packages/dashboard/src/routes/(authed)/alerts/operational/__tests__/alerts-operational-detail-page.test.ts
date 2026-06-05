/**
 * alerts-operational-detail-page.test.ts — exercises the
 * /alerts/operational/[id] page server `load()` and the
 * `acknowledge` form action.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import {
	load as opDetailLoad,
	actions as opDetailActions,
} from '../[id]/+page.server';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import type { OperationalAlert } from '@cortexos/contracts';

let pgdb: PgliteDbClient;
let pgClient: import('@electric-sql/pglite').PGlite;
let createdAlertId: number;

vi.mock('$lib/server/db/client', () => ({
	getDb: () => pgdb,
	db: new Proxy({} as PgliteDbClient, { get: (_t, p, r) => Reflect.get(pgdb, p, r) }),
}));

const fakeUser = {
	id: 'user_op',
	username: 'op',
	isAdmin: false, // any authed user can ack — no admin required
	isActive: true,
	groupMemberships: ['cortexos-users' as const],
};

function makeLoadEvent(id: string): Parameters<typeof opDetailLoad>[0] {
	return {
		url: new URL(`http://localhost/alerts/operational/${id}`),
		params: { id },
		locals: { user: fakeUser, session: null },
		 
	} as any;
}

type DetailPageData = { alert: OperationalAlert };

async function loadDetail(event: Parameters<typeof opDetailLoad>[0]): Promise<DetailPageData> {
	return (await opDetailLoad(event)) as unknown as DetailPageData;
}

beforeEach(async () => {
	const r = await createTestDb();
	pgdb = r.db;
	pgClient = r.client;
	const created = await alertsRepo.createOperationalAlert(pgdb, {
		kind: 'test',
		severity: 'warn',
		title: 'Test alert',
	});
	createdAlertId = created.id;
	vi.resetModules();
}, 30_000);

describe('/alerts/operational/[id] page — load()', () => {
	it('returns the adapted alert for an existing id', async () => {
		const data = await loadDetail(makeLoadEvent(String(createdAlertId)));
		expect(data.alert.title).toBe('Test alert');
		expect(data.alert.severity).toBe('warning'); // warn -> warning
		expect(data.alert.acknowledged).toBe(false);
	});

	it('throws 404 for an unknown id', async () => {
		await expect(loadDetail(makeLoadEvent('999999'))).rejects.toMatchObject({
			status: 404,
		});
	});

	it('throws 400 for a non-numeric id', async () => {
		await expect(loadDetail(makeLoadEvent('not-a-number'))).rejects.toMatchObject({
			status: 400,
		});
	});
});

describe('/alerts/operational/[id] page — actions.acknowledge', () => {
	function makeActionEvent(id = String(createdAlertId)) {
		return {
			url: new URL(`http://localhost/alerts/operational/${id}`),
			params: { id },
			request: new Request(`http://localhost/alerts/operational/${id}`, {
				method: 'POST',
			}),
			locals: { user: fakeUser, session: null },
			 
		} as any;
	}

	it('acknowledge sets acknowledgedAt on the row (non-admin user)', async () => {
		expect(fakeUser.isAdmin).toBe(false);
		const res = await opDetailActions.acknowledge!(makeActionEvent());
		 
		const row = (res as any)?.alert ?? (res as any)?.data?.alert;
		expect(row?.acknowledged).toBe(true);
		expect(row?.acknowledgedAt).toBeTruthy();
		const after = await alertsRepo.getOperationalAlertById(pgdb, createdAlertId);
		expect(after?.acknowledgedAt).toBeInstanceOf(Date);
	});

	it('re-acknowledge returns the current (already-acked) row without error', async () => {
		await alertsRepo.acknowledgeOperationalAlert(pgdb, createdAlertId);
		const res = await opDetailActions.acknowledge!(makeActionEvent());
		 
		const row = (res as any)?.alert ?? (res as any)?.data?.alert;
		expect(row?.acknowledged).toBe(true);
	});

	it('returns 400 for an invalid id', async () => {
		const res = await opDetailActions.acknowledge!(makeActionEvent('abc'));
		 
		expect((res as any)?.status).toBe(400);
	});

	it('returns 404 for a missing id', async () => {
		const res = await opDetailActions.acknowledge!(makeActionEvent('999999'));
		 
		expect((res as any)?.status).toBe(404);
	});
});
