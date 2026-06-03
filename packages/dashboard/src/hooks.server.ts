/**
 * CortexOS dashboard — server hooks.
 *
 * Lifecycle:
 *   - `handle` runs for every request and is the only place that mutates
 *     `event.locals` (locals must not be assigned outside the hook).
 *   - Auth + session resolution is **stubbed** in M1-WS2. The full
 *     implementation lands in M1-WS5-mock-api (mock user from
 *     `dashboard.env` / fixtures) and M1-WS4-backend-skeleton (real
 *     PAM + DB session via `@cortexos/auth`).
 *   - Real implementation: read `session_token` cookie, call
 *     `getSessionByToken`, attach `user` + `session` to `locals`.
 *
 * Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy,
 * Permissions-Policy) are applied here so they land on **every**
 * response, including error pages and API routes. Mirror the
 * configuration that the previous Next.js dashboard emitted in
 * `next.config.ts:7-21` (see `packages/cortex-dashboard/docs/CURRENT_ARCHITECTURE_AUDIT.md`).
 *
 * NOTE: the response-header block is intentionally a TODO until M1-WS5
 * lands — wrong CSP values will block the SvelteKit dev server's HMR
 * overlay. The skeleton here sets only the framework-agnostic headers
 * (X-Content-Type-Options, Referrer-Policy, X-Frame-Options).
 */

import type { Handle } from '@sveltejs/kit';

const FRAMEWORK_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function newRequestId(): string {
	// 16 hex chars; collision-rare for single-process dev. M1-WS5 should
	// replace with `crypto.randomUUID()`.
	return (
		Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
	).padStart(16, '0');
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.requestId = newRequestId();
	event.locals.user = null;
	event.locals.session = null;

	const response = await resolve(event);

	for (const [name, value] of Object.entries(FRAMEWORK_HEADERS)) {
		// Only set the header if SvelteKit didn't already emit one
		// (e.g. content-type negotiation). This is future-proof for M1-WS5.
		if (!response.headers.has(name)) response.headers.set(name, value);
	}

	return response;
};
