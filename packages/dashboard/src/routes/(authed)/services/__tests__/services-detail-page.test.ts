/**
 * services-detail-page.test.ts — exercises the /services/[id] page
 * server `load()` and the `recheck` form action, plus the
 * `+server.ts` POST endpoint that exposes the same business logic
 * to non-browser clients.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetStubData, createService } from '$lib/server/stub-data';
import { makeFakeEvent } from '$lib/server/test-utils';
import {
	load as detailLoad,
	actions,
} from '../../../../routes/(authed)/services/[id]/+page.server';
import { POST as healthPost } from '../../../../routes/(authed)/services/[id]/health/+server';

beforeEach(() => {
	_resetStubData();
});

function makeDetailLoadEvent(id: string) {
	return {
		url: new URL(`http://localhost/services/${id}`),
		params: { id },
	} as unknown as Parameters<typeof detailLoad>[0];
}

function makeActionEvent(id: string) {
	return {
		url: new URL(`http://localhost/services/${id}`),
		params: { id },
		request: new Request(`http://localhost/services/${id}?/recheck`, { method: 'POST' }),
	} as unknown as Parameters<NonNullable<typeof actions.recheck>>[0];
}

describe('/services/[id] detail page — load()', () => {
	it('loads a service by slug', async () => {
		createService({
			slug: 'caddy',
			name: 'Caddy',
			description: 'web',
			healthUrl: 'https://caddy/x',
			healthType: 'http',
			category: 'Web',
			openUrl: 'https://caddy',
			status: 'online',
			kind: 'app',
			envSource: null,
			isActive: true,
			hasWebui: true,
			showInHealthcheck: true,
			showInWebui: true,
			sortOrder: 0,
		});
		const data = await detailLoad(makeDetailLoadEvent('caddy'));
		expect(data.service.slug).toBe('caddy');
		expect(data.service.name).toBe('Caddy');
		expect(data.service.status).toBe('online');
	});

	it('throws a 404 for a missing service', async () => {
		await expect(detailLoad(makeDetailLoadEvent('nope'))).rejects.toMatchObject({
			status: 404,
		});
	});

	it('loads a service by numeric id (legacy links)', async () => {
		const created = createService({
			slug: 'numeric',
			name: 'Numeric',
			description: 'id-based lookup',
			healthUrl: 'https://n/x',
			healthType: 'http',
			category: 'Web',
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
		const data = await detailLoad(makeDetailLoadEvent(created.id));
		expect(data.service.slug).toBe('numeric');
	});
});

describe('/services/[id] detail page — recheck action', () => {
	it('returns a snapshot for an existing service', async () => {
		createService({
			slug: 'recheck',
			name: 'Recheck',
			description: '',
			healthUrl: 'https://r/x',
			healthType: 'http',
			category: 'Web',
			openUrl: null,
			status: 'online',
			kind: 'app',
			envSource: null,
			isActive: true,
			hasWebui: false,
			showInHealthcheck: true,
			showInWebui: true,
			sortOrder: 0,
		});
		// Invoke the action. The action returns a `FormResult`; we
		// only care about the success shape.
		const recheck = actions.recheck as unknown as (e: Parameters<NonNullable<typeof actions.recheck>>[0]) => Promise<unknown>;
		const result = await recheck(makeActionEvent('recheck'));
		// SvelteKit wraps the return as a `ActionSuccess` object.
		expect(result).toMatchObject({ type: 'success' });
		const body = (result as { data?: { ok: boolean; snapshot: { status: string } } }).data;
		expect(body?.ok).toBe(true);
		expect(body?.snapshot.status).toBe('checking');
	});

	it('returns a 404 when the service is missing', async () => {
		const recheck = actions.recheck as unknown as (e: Parameters<NonNullable<typeof actions.recheck>>[0]) => Promise<unknown>;
		const result = await recheck(makeActionEvent('does-not-exist'));
		expect(result).toMatchObject({ status: 404 });
	});
});

describe('/services/[id]/health +server.ts', () => {
	it('POST triggers a recheck and returns a JSON snapshot', async () => {
		createService({
			slug: 'http-recheck',
			name: 'HTTP',
			description: '',
			healthUrl: 'https://h/x',
			healthType: 'http',
			category: 'Web',
			openUrl: null,
			status: 'online',
			kind: 'app',
			envSource: null,
			isActive: true,
			hasWebui: false,
			showInHealthcheck: true,
			showInWebui: true,
			sortOrder: 0,
		});
		const res = await (healthPost as unknown as (e: unknown) => Promise<Response>)(
			makeFakeEvent({
				method: 'POST',
				params: { id: 'http-recheck' },
				url: 'http://localhost/services/http-recheck/health',
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; snapshot: { status: string } };
		expect(body.ok).toBe(true);
		expect(body.snapshot.status).toBe('checking');
	});

	it('POST returns 404 for a missing service', async () => {
		const res = await (healthPost as unknown as (e: unknown) => Promise<Response>)(
			makeFakeEvent({
				method: 'POST',
				params: { id: 'missing' },
				url: 'http://localhost/services/missing/health',
			}),
		);
		expect(res.status).toBe(404);
	});

	it('GET is method-not-allowed (405)', async () => {
		const res = await (healthPost as unknown as (e: unknown) => Promise<Response>)(
			makeFakeEvent({
				method: 'GET',
				params: { id: 'http-recheck' },
				url: 'http://localhost/services/http-recheck/health',
			}),
		);
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('POST');
	});
});
