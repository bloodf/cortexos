/**
 * services-detail-page.test.ts — exercises the /services/[id] page
 * server `load()` and the `recheck` form action, plus the
 * `+server.ts` POST endpoint that exposes the same business logic
 * to non-browser clients.
 *
 * Direct invocation note: when `actions.recheck` is called
 * directly (not through the SvelteKit form-action dispatch), the
 * return value is the *raw* handler result — SvelteKit only wraps
 * it in `{ type: 'success' | 'failure' | 'redirect' }` when
 * dispatched through the form-action protocol. These tests assert
 * the raw shape, which is the contract a sibling `+server.ts`
 * POST endpoint would also see.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetStubData, createService } from '$lib/server/stub-data';
import { makeFakeEvent } from '$lib/server/test-utils';
import {
	load as detailLoad,
	actions,
} from '../../../../routes/(authed)/services/[id]/+page.server';
import {
	POST as healthPost,
	GET as healthGet,
} from '../../../../routes/(authed)/services/[id]/health/+server';

beforeEach(() => {
	_resetStubData();
});

function makeDetailLoadEvent(id: string) {
	return {
		url: new URL(`http://localhost/services/${id}`),
		params: { id },
	} as unknown as Parameters<typeof detailLoad>[0];
}

/** Shape of the detail page-server's return value. */
type DetailPageData = {
	service: { slug: string; name: string; status: string; [k: string]: unknown };
	history: Array<{ id: string; status: string; [k: string]: unknown }>;
};

async function loadDetail(event: ReturnType<typeof makeDetailLoadEvent>): Promise<DetailPageData> {
	return (await detailLoad(event)) as unknown as DetailPageData;
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
		const data = await loadDetail(makeDetailLoadEvent('caddy'));
		expect(data.service.slug).toBe('caddy');
		expect(data.service.name).toBe('Caddy');
		expect(data.service.status).toBe('online');
	});

	it('throws a 404 for a missing service', async () => {
		await expect(loadDetail(makeDetailLoadEvent('nope'))).rejects.toMatchObject({
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
		const data = await loadDetail(makeDetailLoadEvent(created.id));
		expect(data.service.slug).toBe('numeric');
	});
});

describe('/services/[id] detail page — recheck action', () => {
	it('returns the raw handler result for an existing service', async () => {
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
		// Direct invocation — the handler returns the raw object,
		// not the SvelteKit-wrapped `{ type: 'success' }` envelope.
		const recheck = actions.recheck as unknown as (
			e: Parameters<NonNullable<typeof actions.recheck>>[0],
		) => Promise<{ ok: boolean; snapshot: { status: string } }>;
		const result = await recheck(makeActionEvent('recheck'));
		expect(result.ok).toBe(true);
		expect(result.snapshot.status).toBe('checking');
	});

	it('returns a fail(404) result when the service is missing', async () => {
		// `fail(404, ...)` is a typed return, not a thrown error.
		// The handler resolves to the ActionFailure object.
		const recheck = actions.recheck as unknown as (
			e: Parameters<NonNullable<typeof actions.recheck>>[0],
		) => Promise<{ status: number; data?: { error?: string } }>;
		const result = await recheck(makeActionEvent('does-not-exist'));
		expect(result.status).toBe(404);
		expect(result.data?.error).toMatch(/not found/i);
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
		// Invoke the dedicated GET handler — it returns 405 with
		// `Allow: POST`. POST is rejected with 405 for the same
		// reason, but only GET is canonical for "non-POST verbs".
		const res = await (healthGet as unknown as (e: unknown) => Promise<Response>)(
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
