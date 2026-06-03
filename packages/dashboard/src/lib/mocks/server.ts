/**
 * SvelteKit server-side mock layer.
 *
 * `hooks.server.ts` imports `installMockHandle` and chains it into
 * the `handle` hook:
 *
 *   ```ts
 *   import { installMockHandle } from '$lib/mocks/server';
 *   import { sequence } from '@sveltejs/kit/hooks';
 *   import { handle as authHandle } from '$lib/server/auth/handle';
 *
 *   export const handle = sequence(
 *     installMockHandle({ enabled: process.env.E2E_MOCK_MODE === '1' }),
 *     authHandle,
 *   );
 *   ```
 *
 * In dev/test, `E2E_MOCK_MODE=1` is set by Playwright's `webServer`
 * (configured in `playwright.config.ts`). The hook intercepts every
 * request that matches a mock route and returns the active
 * scenario's response. In production, `E2E_MOCK_MODE` is **not set**
 * and the hook is a no-op (Layer 1 prod-leak guard).
 *
 * ─── Compile-time integration ─────────────────────────────────────
 * SvelteKit's `Handle` / `RequestEvent` types are imported lazily
 * (via `import type`) so the mocks layer compiles cleanly even
 * before M1-WS2's SvelteKit scaffold lands. The `@sveltejs/kit`
 * peer is added by M1-WS2; if it is missing the consumer of
 * `installMockHandle` will see a type error at the call site,
 * which is the correct signal that the scaffold has not landed.
 */

import { resolveScenario, extractScenarioName } from './scenarios';
import { type ScenarioContext } from './scenarios/types';
import { enforceMockMode } from './prod-leak-guard';

/**
 * Minimal structural type for a SvelteKit Handle. We don't depend
 * on `@sveltejs/kit` directly; the type compatibility is checked
 * at the call site. This keeps the mocks layer importable from a
 * worktree that has not yet received the SvelteKit scaffold
 * (M1-WS2 in flight).
 */
export interface MockHandleOptions {
	/**
	 * Set to `false` to bypass the mock layer entirely. The SvelteKit
	 * handle should call this conditionally on `E2E_MOCK_MODE`.
	 */
	enabled: boolean;
}

interface MockHandleEvent {
	url: URL;
	request: Request;
	route: { id: string | null };
	params: Record<string, string>;
}

type Resolve = (event: MockHandleEvent) => Response | Promise<Response>;
export type MockHandle = (args: { event: MockHandleEvent; resolve: Resolve }) => Response | Promise<Response>;

/**
 * Convert a SvelteKit-shaped `RequestEvent` into a `ScenarioContext`.
 * The same context shape is used by both the browser MSW handler
 * and this server hook, so scenarios work uniformly across layers.
 */
function eventToContext(event: MockHandleEvent): ScenarioContext {
	const url = event.url;
	const headers = event.request.headers;
	const method = event.request.method.toUpperCase();
	const pathParams: Record<string, string> = { ...event.params };
	return {
		url,
		method,
		headers,
		body: null, // populated by the route reader below if needed
		pathTemplate: event.route.id ?? url.pathname,
		pathParams,
	};
}

/**
 * The mock layer's SvelteKit-compatible `Handle`. Returns a
 * passthrough when disabled; otherwise resolves the active
 * scenario and returns its response.
 *
 * Layer 2 of the prod-leak guard: at module top we throw if
 * `process.env.NODE_ENV === 'production'`. Even an accidental
 * import of this file in a production build is fatal.
 */
enforceMockMode('server');

export function installMockHandle(opts: MockHandleOptions): MockHandle {
	return async ({ event, resolve }) => {
		if (!opts.enabled) {
			return resolve(event);
		}
		const ctx = eventToContext(event);
		// Only intercept /api/* paths. Everything else (page
		// navigation, asset requests) flows through to SvelteKit.
		if (!ctx.pathTemplate.startsWith('/api/')) {
			return resolve(event);
		}
		// Read body once for non-GET methods.
		if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
			try {
				const text = await event.request.clone().text();
				ctx.body = text ? JSON.parse(text) : null;
			} catch {
				ctx.body = null;
			}
		}
		const scenario = resolveScenario(ctx);
		if (!scenario.matches(ctx)) {
			// No scenario matches → fall through to the real +server.ts
			// route handler.
			return resolve(event);
		}
		const response = await scenario.respond(ctx);
		// Attach scenario debug header.
		const headers = new Headers(response.headers);
		headers.set('x-mock-scenario-active', extractScenarioName(ctx));
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}

/**
 * Default `Handle` factory used by hooks.server.ts. Reads the env
 * var directly so callers can simply do:
 *
 *   export const handle = sequence(installMockHandleFromEnv(), authHandle);
 */
export function installMockHandleFromEnv(): MockHandle {
	return installMockHandle({ enabled: process.env.E2E_MOCK_MODE === '1' });
}
