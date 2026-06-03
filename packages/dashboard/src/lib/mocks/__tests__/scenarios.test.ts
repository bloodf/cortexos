/**
 * Scenario behaviour tests.
 *
 * For each scenario in the catalog:
 *   - `matches` returns true for the requests the scenario claims to
 *     cover.
 *   - `respond` returns a `Response` with the documented status
 *     code and a Zod-parseable body where applicable.
 *
 * These tests run in the vitest "happy" environment, so the
 * `enforceMockMode` guard is satisfied and the registry imports
 * cleanly.
 */

import { describe, it, expect } from 'vitest';
import happy from '../scenarios/happy';
import empty from '../scenarios/empty';
import error from '../scenarios/error';
import denied from '../scenarios/denied';
import slow from '../scenarios/slow';
import timeoutScenario from '../scenarios/timeout';
import destructive from '../scenarios/destructive';
import approval from '../scenarios/approval';
import deniedRbac from '../scenarios/denied-rbac';
import deniedRht2fa from '../scenarios/denied-rht-2fa';
import deniedMfa from '../scenarios/denied-mfa';
import auditFail from '../scenarios/audit-fail';
import type { ScenarioContext } from '../scenarios/types';

const ctx = (over: Partial<ScenarioContext> = {}): ScenarioContext => ({
	url: new URL('http://localhost/api/services'),
	method: 'GET',
	headers: new Headers(),
	body: null,
	pathTemplate: '/api/services',
	pathParams: {},
	...over,
});

describe('happy', () => {
	it('matches every request', () => {
		expect(happy.matches(ctx())).toBe(true);
	});

	it('returns 200 + canonical body', async () => {
		const res = await happy.respond(ctx());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.services).toBeDefined();
		expect(Array.isArray(body.services)).toBe(true);
	});
});

describe('empty', () => {
	it('matches every request', () => {
		expect(empty.matches(ctx())).toBe(true);
	});

	it('replaces arrays with []', async () => {
		const res = await empty.respond(ctx());
		const body = await res.json();
		expect(body.services).toEqual([]);
	});
});

describe('error', () => {
	it('returns 500 + INTERNAL_ERROR envelope', async () => {
		const res = await error.respond(ctx());
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.code).toBe('INTERNAL_ERROR');
	});
});

describe('denied', () => {
	it('returns 401 on /api/auth', async () => {
		const res = await denied.respond(ctx({ pathTemplate: '/api/auth' }));
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.code).toBe('AUTH_ERROR');
	});

	it('returns 403 PERMISSION_DENIED on other paths', async () => {
		const res = await denied.respond(ctx({ pathTemplate: '/api/services' }));
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.code).toBe('PERMISSION_DENIED');
	});
});

describe('slow', () => {
	it('advertises a 1.5s delay', () => {
		expect(slow.delayMs).toBe(1500);
	});
});

describe('timeout', () => {
	it('advertises a 10s delay', () => {
		expect(timeoutScenario.delayMs).toBe(10_000);
	});
});

describe('destructive', () => {
	it('returns 403 APPROVAL_REQUIRED without the token header', async () => {
		const res = await destructive.respond(ctx({ method: 'POST' }));
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.code).toBe('APPROVAL_REQUIRED');
	});

	it('returns 200 when X-Cortex-Confirmation-Token is present', async () => {
		const res = await destructive.respond(
			ctx({ method: 'POST', headers: new Headers({ 'x-cortex-confirmation-token': 'tok' }) }),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});
});

describe('approval', () => {
	it('returns pending approvals on GET /api/approvals', async () => {
		const res = await approval.respond(ctx({ pathTemplate: '/api/approvals' }));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.approvals).toBeDefined();
		expect(body.approvals.every((a: { status: string }) => a.status === 'pending')).toBe(true);
	});
});

describe('denied-rbac', () => {
	it('returns 403 on /api/admin/* paths', async () => {
		const res = await deniedRbac.respond(ctx({ pathTemplate: '/api/admin/users' }));
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.code).toBe('PERMISSION_DENIED');
		expect(body.requiredRole).toBe('admin');
	});

	it('returns 403 on /api/docker/actions (admin-only)', async () => {
		const res = await deniedRbac.respond(ctx({ pathTemplate: '/api/docker/actions' }));
		expect(res.status).toBe(403);
	});
});

describe('denied-rht-2fa', () => {
	it('returns 401 RHT_2FA_REQUIRED on /api/terminal', async () => {
		const res = await deniedRht2fa.respond(ctx({ pathTemplate: '/api/terminal' }));
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.code).toBe('RHT_2FA_REQUIRED');
	});
});

describe('denied-mfa', () => {
	it('returns 401 MFA_REQUIRED on /api/auth/password', async () => {
		const res = await deniedMfa.respond(
			ctx({ pathTemplate: '/api/auth/password', method: 'POST' }),
		);
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.code).toBe('MFA_REQUIRED');
	});
});

describe('audit-fail', () => {
	it('returns 500 AUDIT_CHAIN_INVALID on /api/audit/verify', async () => {
		const res = await auditFail.respond(ctx({ pathTemplate: '/api/audit/verify' }));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.code).toBe('AUDIT_CHAIN_INVALID');
		expect(body.brokenAtEventId).toBeDefined();
	});

	it('returns chainOk: false on /api/audit', async () => {
		const res = await auditFail.respond(ctx({ pathTemplate: '/api/audit' }));
		const body = await res.json();
		expect(body.chainOk).toBe(false);
	});
});
