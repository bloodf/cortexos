/**
 * E2E scenario switcher — helper for Playwright tests.
 *
 * Switches the active mock scenario at runtime via the
 * `x-mock-scenario` header (preferred) or `?scenario=…` query
 * (fallback for tests that cannot set headers, e.g. asset preloads).
 *
 * Usage in a spec:
 *
 *   import { test, expect } from '@playwright/test';
 *   import { setScenario, withScenario } from './helpers/scenario';
 *
 *   test('overview shows the empty state', async ({ page }) => {
 *     await setScenario(page, 'empty');
 *     await page.goto('/overview');
 *     // … assertions
 *   });
 *
 *   test('docker start errors show a toast', async ({ page }) => {
 *     await withScenario(page, 'error', async () => {
 *       await page.goto('/docker');
 *       // … assertions
 *     });
 *   });
 *
 * How the switch reaches the mocks:
 *   - Browser fetches: MSW worker reads `x-mock-scenario` from the
 *     request headers (or `?scenario=` from the URL). The worker is
 *     started by `+layout.svelte` in dev/test mode (M1-WS2 wires
 *     the boot).
 *   - Server-side fetches (from `+page.server.ts` / `+server.ts`):
 *     the SvelteKit `handle` hook in `src/hooks.server.ts` reads
 *     the same header. With `E2E_MOCK_MODE=1` in the dev server
 *     env, the hook short-circuits to the mock layer.
 *
 * The switch is **hot**: no server restart is needed. Scenarios
 * persist for the lifetime of the test context (i.e. the page).
 */

import type { Page, APIRequestContext } from '@playwright/test';

export type ScenarioName =
	| 'happy'
	| 'empty'
	| 'error'
	| 'denied'
	| 'slow'
	| 'timeout'
	| 'destructive'
	| 'approval'
	| 'denied-rbac'
	| 'denied-rht-2fa'
	| 'denied-mfa'
	| 'audit-fail';

const SCENARIO_HEADER = 'x-mock-scenario';

/**
 * Set the active mock scenario for the rest of this test.
 *
 * Implementation: writes a cookie that the SvelteKit `handle` hook
 * reads as a fallback when the request has no `x-mock-scenario`
 * header. (Browser fetches via MSW see the header directly; SSR
 * fetches see the cookie via `event.cookies`.)
 *
 * For per-request control in a `test.beforeEach`, prefer
 * `setScenarioForRequest(req, name)` against the page's
 * `context.request` / `context.route` API.
 */
export async function setScenario(page: Page, name: ScenarioName): Promise<void> {
	await page.context().addCookies([
		{
			name: SCENARIO_HEADER,
			value: name,
			domain: 'localhost',
			path: '/',
			httpOnly: false,
			sameSite: 'Lax',
		},
	]);
}

/**
 * Run a callback with a specific scenario active, restoring the
 * previous scenario afterwards. Mirrors the `withLocale` /
 * `withFeatureFlag` patterns common in E2E suites.
 */
export async function withScenario(
	page: Page,
	name: ScenarioName,
	fn: () => Promise<void>,
): Promise<void> {
	const previous = await page.context().cookies();
	await setScenario(page, name);
	try {
		await fn();
	} finally {
		// Restore previous cookies (or clear if none).
		await page.context().clearCookies();
		for (const c of previous) {
			await page.context().addCookies([c]);
		}
	}
}

/**
 * Set the scenario for a specific API request (Playwright
 * `APIRequestContext`). The header is applied to that request only.
 */
export async function setScenarioForRequest(
	req: APIRequestContext,
	name: ScenarioName,
): Promise<void> {
	// The header is set on the request via the second argument of
	// `req.get` / `req.post`. This helper is a thin marker so the
	// intent is visible in the test code:
	void req;
	void name;
	// Implementers: pass `{ headers: { 'x-mock-scenario': name } }`
	// to the request method directly.
}

/** Map of canonical scenario → purpose. */
export const SCENARIO_PURPOSES: Record<ScenarioName, string> = {
	happy: 'Default. All services online, all data available.',
	empty: 'List endpoints return []; UI empty-state branches.',
	error: '500 INTERNAL_ERROR on every endpoint; UI error toasts.',
	denied: '401/403 on auth + admin endpoints; UI denies actions.',
	slow: '1.5s delay; UI loading skeletons.',
	timeout: '10s delay; UI timeout handling.',
	destructive: 'Destructive ops require X-Cortex-Confirmation-Token.',
	approval: 'Pending approvals only; /api/approvals returns status=pending rows.',
	'denied-rbac': 'Standard user hitting admin endpoints; requiredRole=admin.',
	'denied-rht-2fa': 'Real-host test surface requires 2FA challenge.',
	'denied-mfa': 'Generic MFA challenge; TOTP/WebAuthn.',
	'audit-fail': 'Audit chain integrity check fails; banner with broken-at id.',
};
