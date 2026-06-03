/**
 * services-list-page.test.ts — exercises the /services list page
 * server `load()`: returns the adapted services, derives the unique
 * category list, and honors the URL bootstrap (`?q=` and
 * `?category=`).
 *
 * These tests use the existing `makeFakeEvent` helper so they don't
 * need the SvelteKit test harness.
 *
 * The cast on the `load` return value is intentional: the auto-
 * inferred PageData type unions in the layout's `user` / `session`
 * branch cause the page data to look like `void | { services: ... }`
 * to svelte-check. We assert against the actual page-server return
 * shape, which is the contract we're testing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetStubData, createService } from '$lib/server/stub-data';
import { load as servicesListLoad } from '../../../../routes/(authed)/services/+page.server';

beforeEach(() => {
	_resetStubData();
});

function makeLoadEvent(url: string, params: Record<string, string> = {}) {
	const u = new URL(url, 'http://localhost/');
	return { url: u, params } as unknown as Parameters<typeof servicesListLoad>[0];
}

/** Shape of the page-server's return value (from +page.server.ts). */
type ListPageData = {
	services: Array<{ id: string; slug: string; name: string; status: string; [k: string]: unknown }>;
	categories: string[];
	initialQuery: string;
	initialCategory: string;
};

async function loadList(event: ReturnType<typeof makeLoadEvent>): Promise<ListPageData> {
	return (await servicesListLoad(event)) as unknown as ListPageData;
}

describe('/services list page — load()', () => {
	it('returns the empty list shape when there are no services', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/services'));
		expect(data.services).toEqual([]);
		expect(data.categories).toEqual([]);
	});

	it('returns adapted services and the sorted unique categories', async () => {
		createService({
			slug: 'a',
			name: 'A',
			description: 'first',
			healthUrl: null,
			healthType: 'http',
			category: 'AI',
			openUrl: null,
			status: 'online',
			kind: 'app',
			envSource: null,
			isActive: true,
			hasWebui: true,
			showInHealthcheck: true,
			showInWebui: true,
			sortOrder: 0,
		});
		createService({
			slug: 'b',
			name: 'B',
			description: 'second',
			healthUrl: null,
			healthType: 'tcp',
			category: 'Database',
			openUrl: null,
			status: 'offline',
			kind: 'docker',
			envSource: null,
			isActive: true,
			hasWebui: false,
			showInHealthcheck: true,
			showInWebui: true,
			sortOrder: 1,
		});
		createService({
			slug: 'c',
			name: 'C',
			description: 'third',
			healthUrl: null,
			healthType: 'http',
			category: 'AI',
			openUrl: null,
			status: 'online',
			kind: 'service',
			envSource: null,
			isActive: true,
			hasWebui: true,
			showInHealthcheck: true,
			showInWebui: true,
			sortOrder: 2,
		});

		const data = await loadList(makeLoadEvent('http://localhost/services'));
		expect(data.services).toHaveLength(3);
		expect(data.categories).toEqual(['AI', 'Database']);
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
