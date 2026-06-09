// @vitest-environment node
/**
 * services-list-page.test.ts — exercises the /services list page
 * server `load()`: returns the adapted services, derives the unique
 * category list, and honors the URL bootstrap (`?q=` and
 * `?category=`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import type { PGlite } from '@electric-sql/pglite';
import { createService } from '$lib/server/db/repos/services';

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

function makeLoadEvent(url: string, params: Record<string, string> = {}) {
	const u = new URL(url, 'http://localhost/');
	return { url: u, params } as unknown as Parameters<typeof load>[0];
}

/** Shape of the page-server's return value (from +page.server.ts). */
type ListPageData = {
	services: Array<{ id: string; slug: string; name: string; status: string; [k: string]: unknown }>;
	categories: string[];
	initialQuery: string;
	initialCategory: string;
};

async function loadList(event: ReturnType<typeof makeLoadEvent>): Promise<ListPageData> {
	return (await load(event)) as unknown as ListPageData;
}

describe('/services list page — load()', () => {
	it('returns adapted services and the sorted unique categories', async () => {
		await createService(db, {
			slug: 'a',
			name: 'A',
			description: 'first',
			healthUrl: '#',
			healthType: 'http',
			category: 'AI',
			openUrl: "#",
			status: 'online',
			kind: 'app',
			envSource: null,
			sortOrder: 0,
			isActive: true,
			hasWebui: true,
			showInHealthcheck: true,
			showInWebui: true,
		});
		await createService(db, {
			slug: 'b',
			name: 'B',
			description: 'second',
			healthUrl: '#',
			healthType: 'tcp',
			category: 'Database',
			openUrl: "#",
			status: 'offline',
			kind: 'docker',
			envSource: null,
			sortOrder: 1,
			isActive: true,
			hasWebui: false,
			showInHealthcheck: true,
			showInWebui: true,
		});
		await createService(db, {
			slug: 'c',
			name: 'C',
			description: 'third',
			healthUrl: '#',
			healthType: 'http',
			category: 'AI',
			openUrl: "#",
			status: 'online',
			kind: 'service',
			envSource: null,
			sortOrder: 2,
			isActive: true,
			hasWebui: true,
			showInHealthcheck: true,
			showInWebui: true,
		});

		const data = await loadList(makeLoadEvent('http://localhost/services'));
		expect(data.services.length).toBeGreaterThanOrEqual(3);
		expect(data.categories).toContain('AI');
		expect(data.categories).toContain('Database');
		expect(data.services[0]?.status).toMatch(/^(online|offline|unknown|checking|degraded)$/);
		expect(data.services[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('reads the initial query and category from the URL', async () => {
		const data = await loadList(
			makeLoadEvent('http://localhost/services?q=graf&category=Monitoring'),
		);
		expect(data.initialQuery).toBe('graf');
		expect(data.initialCategory).toBe('Monitoring');
	});

	it('returns empty initial values when the URL has no params', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/services'));
		expect(data.initialQuery).toBe('');
		expect(data.initialCategory).toBe('');
	});
});
