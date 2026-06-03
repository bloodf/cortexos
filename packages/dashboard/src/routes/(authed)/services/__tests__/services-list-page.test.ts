/**
 * services-list-page.test.ts — exercises the /services list page
 * server `load()`: returns the adapted services, derives the unique
 * category list, and honors the URL bootstrap (`?q=` and
 * `?category=`).
 *
 * These tests use the existing `makeFakeEvent` helper so they don't
 * need the SvelteKit test harness.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetStubData, createService } from '$lib/server/stub-data';
import { load as servicesListLoad } from '../../../../routes/(authed)/services/+page.server';

beforeEach(() => {
	_resetStubData();
});

function makeLoadEvent(url: string, params: Record<string, string> = {}) {
	// We only need `url` for the load function; `params` is here for
	// symmetry with the action tests.
	const u = new URL(url, 'http://localhost/');
	return { url: u, params } as unknown as Parameters<typeof servicesListLoad>[0];
}

describe('/services list page — load()', () => {
	it('returns the empty list shape when there are no services', async () => {
		const data = await servicesListLoad(makeLoadEvent('http://localhost/services'));
		expect(data.services).toEqual([]);
		expect(data.categories).toEqual([]);
	});

	it('returns adapted services and the sorted unique categories', async () => {
		// Seed the stub store with a few services across categories.
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
			category: 'AI', // duplicate
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

		const data = await servicesListLoad(makeLoadEvent('http://localhost/services'));
		expect(data.services).toHaveLength(3);
		// Sorted unique categories: AI, Database.
		expect(data.categories).toEqual(['AI', 'Database']);
		// The adapted rows match the contracts shape (status is a
		// member of the contracts union).
		expect(data.services[0]?.status).toMatch(/^(online|offline|unknown|checking|degraded)$/);
		// The contracts id is a UUID v4.
		expect(data.services[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('reads the initial query and category from the URL', async () => {
		const data = await servicesListLoad(
			makeLoadEvent('http://localhost/services?q=graf&category=Monitoring'),
		);
		expect(data.initialQuery).toBe('graf');
		expect(data.initialCategory).toBe('Monitoring');
	});

	it('returns empty initial values when the URL has no params', async () => {
		const data = await servicesListLoad(makeLoadEvent('http://localhost/services'));
		expect(data.initialQuery).toBe('');
		expect(data.initialCategory).toBe('');
	});
});
