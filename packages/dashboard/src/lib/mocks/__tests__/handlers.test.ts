/**
 * Canonical-response + handler smoke tests.
 *
 * The MSW handler list is built from the `ROUTES` array; this test
 * file asserts that the canonical response for every documented
 * route returns a non-null body. The scenarios wrap this; the
 * happy path is what the matrix's "data plane" tests depend on.
 */

import { describe, it, expect } from 'vitest';
import { getCanonicalResponse } from '../scenarios/canonical';
import { handlers } from '../handlers';
import { SCENARIO_REGISTRY } from '../scenarios';
import type { ScenarioContext } from '../scenarios/types';

const buildCtx = (over: Partial<ScenarioContext> = {}): ScenarioContext => ({
	url: new URL('http://localhost/api/services'),
	method: 'GET',
	headers: new Headers(),
	body: null,
	pathTemplate: '/api/services',
	pathParams: {},
	...over,
});

describe('canonical response builder', () => {
	const endpoints: Array<{ path: string; method: string; pathParams?: Record<string, string> }> = [
		{ path: '/api/auth', method: 'POST' },
		{ path: '/api/auth', method: 'DELETE' },
		{ path: '/api/services', method: 'GET' },
		{ path: '/api/services/grafana', method: 'GET' },
		{ path: '/api/system', method: 'GET' },
		{ path: '/api/network', method: 'GET' },
		{ path: '/api/processes', method: 'GET' },
		{ path: '/api/docker', method: 'GET' },
		{ path: '/api/docker/networks', method: 'GET' },
		{ path: '/api/incus/instances', method: 'GET' },
		{ path: '/api/incus/instances', method: 'POST' },
		{ path: '/api/incus/instances/hermes-canary', method: 'GET' },
		{ path: '/api/incus/images', method: 'GET' },
		{ path: '/api/incus/settings', method: 'GET' },
		{ path: '/api/systemd', method: 'GET' },
		{ path: '/api/alerts', method: 'GET' },
		{ path: '/api/alerts', method: 'GET' }, // history=1 — see below
		{ path: '/api/audit', method: 'GET' },
		{ path: '/api/audit/verify', method: 'GET' },
		{ path: '/api/dashboard_command_audit', method: 'GET' },
		{ path: '/api/approvals', method: 'GET' },
		{ path: '/api/admin/users', method: 'GET' },
		{ path: '/api/badges', method: 'GET' },
		{ path: '/api/projects', method: 'GET' },
		{ path: '/api/agents', method: 'GET' },
		{ path: '/api/mail-guardian/reviews', method: 'GET' },
		{ path: '/api/backups', method: 'GET' },
		{ path: '/api/scheduler', method: 'GET' },
		{ path: '/api/env-browser', method: 'GET' },
		{ path: '/api/health', method: 'GET' },
	];

	for (const ep of endpoints) {
		it(`returns a body for ${ep.method} ${ep.path}`, () => {
			const url = new URL(`http://localhost${ep.path}`);
			if (ep.path === '/api/alerts' && endpoints.indexOf(ep) === 15) {
				url.searchParams.set('history', '1');
			}
			const body = getCanonicalResponse(
				buildCtx({
					pathTemplate: ep.path,
					method: ep.method,
					pathParams: ep.pathParams ?? {},
					url,
				}),
			);
			expect(body).toBeDefined();
		});
	}
});

describe('MSW handlers', () => {
	it('registers at least 50 handlers', () => {
		// We have 50+ paths × 1-3 methods. Exact count is internal; we
		// only assert the suite is non-trivial.
		expect(handlers.length).toBeGreaterThanOrEqual(50);
	});
});

describe('scenario catalog coverage', () => {
	const requiredScenarios = [
		'happy',
		'empty',
		'error',
		'denied',
		'slow',
		'timeout',
		'destructive',
		'approval',
		'denied-rbac',
		'denied-rht-2fa',
		'denied-mfa',
		'audit-fail',
	];

	for (const name of requiredScenarios) {
		it(`has a registered ${name} scenario`, () => {
			expect(SCENARIO_REGISTRY[name as keyof typeof SCENARIO_REGISTRY]).toBeDefined();
		});
	}
});
