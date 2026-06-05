/**
 * alerts-list-page.test.ts — exercises the /alerts index page
 * server `load()`: returns the adapted rules, operational
 * alerts, and history; honors the URL bootstrap (filters).
 *
 * The page-server imports `getDb` from `$lib/server/db/client`.
 * We mock the client module so the loader uses the in-memory
 * pglite DB created in `createTestDb()` instead of a real pool.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import { load as alertsListLoad } from '../../../../routes/(authed)/alerts/+page.server';
import type {
	AlertRule,
	OperationalAlert,
	AlertEvent,
	AlertSeverity,
} from '@cortexos/contracts';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';

let pgdb: PgliteDbClient;
let pgClient: import('@electric-sql/pglite').PGlite;
let serviceId: number;

// Mock the DB client so the page-server uses our pglite instance.
vi.mock('$lib/server/db/client', () => ({
	getDb: () => pgdb,
	db: new Proxy({} as PgliteDbClient, { get: (_t, p, r) => Reflect.get(pgdb, p, r) }),
}));

// Test user that satisfies the (authed) layout contract.
const fakeAdmin = {
	id: 'user_admin',
	username: 'admin',
	isAdmin: true,
	isActive: true,
	groupMemberships: ['cortexos-admin' as const],
};

function makeLoadEvent(url: string): Parameters<typeof alertsListLoad>[0] {
	const u = new URL(url, 'http://localhost/');
	return {
		url: u,
		params: {},
		locals: {
			user: fakeAdmin,
			session: null,
		},
		 
	} as any;
}

/** Shape of the page-server's return value (from +page.server.ts). */
type ListPageData = {
	rules: AlertRule[];
	operational: OperationalAlert[];
	history: AlertEvent[];
	filters: {
		severity: AlertSeverity | null;
		ruleStatus: 'all' | 'enabled' | 'disabled';
		ackStatus: 'all' | 'unacknowledged' | 'acknowledged';
	};
	canManageRules: boolean;
};

async function loadList(event: Parameters<typeof alertsListLoad>[0]): Promise<ListPageData> {
	return (await alertsListLoad(event)) as unknown as ListPageData;
}

beforeEach(async () => {
	const r = await createTestDb();
	pgdb = r.db;
	pgClient = r.client;
	const { services } = await import('$lib/server/db/schema');
	const svc = await pgdb.select().from(services).limit(1);
	serviceId = svc[0]!.id;
	// Force vi.mock to re-evaluate getDb with the new pgdb.
	vi.resetModules();
}, 30_000);

describe('/alerts list page — load()', () => {
	it('returns empty arrays when there are no rules or operational alerts', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/alerts'));
		expect(data.rules).toEqual([]);
		expect(data.operational).toEqual([]);
		expect(data.history).toEqual([]);
	});

	it('returns adapted rules, defaults to all-status, severity null', async () => {
		await alertsRepo.createAlertRule(pgdb, {
			serviceId,
			name: 'Test rule',
			condition: 'offline',
			thresholdMs: null,
			enabled: true,
		});
		const data = await loadList(makeLoadEvent('http://localhost/alerts'));
		expect(data.rules.length).toBeGreaterThan(0);
		expect(data.rules[0]?.name).toBe('Test rule');
		expect(data.filters.ruleStatus).toBe('all');
		expect(data.filters.severity).toBeNull();
		expect(data.filters.ackStatus).toBe('all');
		expect(data.canManageRules).toBe(true);
	});

	it('returns canManageRules=false for non-admins', async () => {
		const nonAdmin = {
			...fakeAdmin,
			isAdmin: false,
			groupMemberships: ['cortexos-users' as const],
		};
		const event = {
			url: new URL('http://localhost/alerts'),
			params: {},
			locals: { user: nonAdmin, session: null },
			 
		} as any;
		const data = await loadList(event);
		expect(data.canManageRules).toBe(false);
	});

	it('redirects unauthenticated users to /login', async () => {
		const event = {
			url: new URL('http://localhost/alerts'),
			params: {},
			locals: { user: null, session: null },
			 
		} as any;
		await expect(loadList(event)).rejects.toMatchObject({
			status: 303,
			location: '/login',
		});
	});
});

// Suppress unused-import lint warnings.
void en;
void ({} as Messages);
