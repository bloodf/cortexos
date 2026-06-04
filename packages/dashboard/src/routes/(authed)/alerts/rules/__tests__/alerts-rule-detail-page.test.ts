/**
 * alerts-rule-detail-page.test.ts — exercises the /alerts/rules/[id]
 * page server `load()` and the `enable` / `disable` form actions.
 *
 * The page-server imports `getDb` from `$lib/server/db/client`. We
 * mock the client module so the loader uses the in-memory pglite
 * DB created in `createTestDb()` instead of a real pool.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import {
	load as ruleDetailLoad,
	actions as ruleDetailActions,
} from '../[id]/+page.server';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import type { AlertRule, AlertEvent } from '@cortexos/contracts';

let pgdb: PgliteDbClient;
let pgClient: import('@electric-sql/pglite').PGlite;
let serviceId: number;
let createdRuleId: number;

vi.mock('$lib/server/db/client', () => ({
	getDb: () => pgdb,
	db: new Proxy({} as PgliteDbClient, { get: (_t, p, r) => Reflect.get(pgdb, p, r) }),
}));

const fakeAdmin = {
	id: 'user_admin',
	username: 'admin',
	isAdmin: true,
	isActive: true,
	groupMemberships: ['cortexos-admin' as const],
};

const fakeUser = {
	id: 'user_op',
	username: 'op',
	isAdmin: false,
	isActive: true,
	groupMemberships: ['cortexos-users' as const],
};

function makeLoadEvent(id: string, user = fakeAdmin): Parameters<typeof ruleDetailLoad>[0] {
	return {
		url: new URL(`http://localhost/alerts/rules/${id}`),
		params: { id },
		locals: { user, session: null },
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

type DetailPageData = {
	rule: AlertRule;
	history: AlertEvent[];
	canToggle: boolean;
};

async function loadDetail(event: Parameters<typeof ruleDetailLoad>[0]): Promise<DetailPageData> {
	return (await ruleDetailLoad(event)) as unknown as DetailPageData;
}

beforeEach(async () => {
	const r = await createTestDb();
	pgdb = r.db;
	pgClient = r.client;
	const { services } = await import('$lib/server/db/schema');
	const svc = await pgdb.select().from(services).limit(1);
	serviceId = svc[0]!.id;
	const created = await alertsRepo.createAlertRule(pgdb, {
		serviceId,
		name: 'Detail test rule',
		condition: 'offline',
		thresholdMs: null,
		enabled: true,
	});
	createdRuleId = created.id;
	vi.resetModules();
}, 30_000);

describe('/alerts/rules/[id] page — load()', () => {
	it('returns the rule + history + canToggle for admins', async () => {
		const data = await loadDetail(makeLoadEvent(String(createdRuleId)));
		expect(data.rule.id).toBeTruthy();
		expect(data.rule.name).toBe('Detail test rule');
		expect(data.canToggle).toBe(true);
	});

	it('returns canToggle=false for non-admins', async () => {
		const nonAdmin = { ...fakeUser, isAdmin: false, groupMemberships: ['cortexos-users'] };
		const data = await loadDetail(makeLoadEvent(String(createdRuleId), nonAdmin as any));
		expect(data.canToggle).toBe(false);
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

	it('redirects unauthenticated users to /login', async () => {
		const event = {
			url: new URL(`http://localhost/alerts/rules/${createdRuleId}`),
			params: { id: String(createdRuleId) },
			locals: { user: null, session: null },
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		await expect(loadDetail(event)).rejects.toMatchObject({
			status: 303,
			location: '/login',
		});
	});
});

describe('/alerts/rules/[id] page — actions.enable / actions.disable', () => {
	function makeActionEvent(
		action: 'enable' | 'disable',
		user = fakeAdmin,
		id = String(createdRuleId),
	) {
		return {
			url: new URL(`http://localhost/alerts/rules/${id}`),
			params: { id },
			request: new Request(`http://localhost/alerts/rules/${id}`, { method: 'POST' }),
			locals: { user, session: null },
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
	}

	it('disable flips enabled=false (admin only)', async () => {
		const res = await ruleDetailActions.disable!(makeActionEvent('disable'));
		// SvelteKit form actions return ActionResult. We only assert the rule state.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((res as any)?.rule?.enabled).toBe(false);
		const after = await alertsRepo.getAlertRuleById(pgdb, createdRuleId);
		expect(after?.enabled).toBe(false);
	});

	it('enable flips enabled=true (admin only)', async () => {
		await alertsRepo.updateAlertRule(pgdb, createdRuleId, { enabled: false });
		const res = await ruleDetailActions.enable!(makeActionEvent('enable'));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((res as any)?.rule?.enabled).toBe(true);
		const after = await alertsRepo.getAlertRuleById(pgdb, createdRuleId);
		expect(after?.enabled).toBe(true);
	});

	it('returns 400 for an invalid id', async () => {
		const res = await ruleDetailActions.disable!(makeActionEvent('disable', fakeAdmin, 'abc'));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((res as any)?.status).toBe(400);
	});
});
