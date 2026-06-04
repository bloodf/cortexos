/**
 * systemd-list-page.test.ts — exercises the /systemd list page
 * server `load()`: returns the seeded units, derives the counts,
 * and honors the URL bootstrap (`?state=active|inactive|failed|all`).
 *
 * The cast on the `load` return value is intentional: the auto-
 * inferred PageData type unions in the layout's `user` / `session`
 * branch cause the page data to look like `void | { units: ... }`
 * to svelte-check. We assert against the actual page-server return
 * shape.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetSystemdBridgeForTests } from '$lib/server/systemd/bridge';
import { load as systemdListLoad } from '../../../../routes/(authed)/systemd/+page.server';

beforeEach(() => {
	_resetSystemdBridgeForTests();
});

function makeLoadEvent(url: string, params: Record<string, string> = {}) {
	const u = new URL(url, 'http://localhost/');
	return { url: u, params } as unknown as Parameters<typeof systemdListLoad>[0];
}

type ListPageData = {
	units: Array<{ name: string; active: string; [k: string]: unknown }>;
	state: 'all' | 'active' | 'inactive' | 'failed';
	counts: { total: number; active: number; inactive: number; failed: number };
};

async function loadList(event: ReturnType<typeof makeLoadEvent>): Promise<ListPageData> {
	return (await systemdListLoad(event)) as unknown as ListPageData;
}

describe('/systemd list page — load()', () => {
	it('returns the seeded units + counts when no filter is set', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/systemd'));
		expect(data.units.length).toBeGreaterThan(0);
		expect(data.state).toBe('all');
		expect(data.counts.total).toBe(data.units.length);
		expect(data.counts.active + data.counts.inactive + data.counts.failed).toBe(
			data.units.length,
		);
	});

	it('honors the ?state=active URL bootstrap', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/systemd?state=active'));
		expect(data.state).toBe('active');
	});

	it('honors the ?state=inactive URL bootstrap', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/systemd?state=inactive'));
		expect(data.state).toBe('inactive');
	});

	it('honors the ?state=failed URL bootstrap', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/systemd?state=failed'));
		expect(data.state).toBe('failed');
	});

	it('falls back to all for an invalid state value', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/systemd?state=bogus'));
		expect(data.state).toBe('all');
	});

	it('returns at least one failed unit in the default seed (nginx)', async () => {
		const data = await loadList(makeLoadEvent('http://localhost/systemd'));
		expect(data.counts.failed).toBeGreaterThanOrEqual(1);
		const failed = data.units.find((u) => u.active === 'failed');
		expect(failed?.name).toBe('nginx.service');
	});
});
