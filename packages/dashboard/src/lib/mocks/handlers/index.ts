/**
 * MSW v2 handler list for every route the mocks cover.
 *
 * The handlers are built by mapping a path template → MSW `http.*`
 * call. The response body comes from the active scenario (resolved
 * from the request's `x-mock-scenario` header or `?scenario=` query
 * param). When the scenario is `happy`, the canonical response is
 * returned; other scenarios may swap the body for an error envelope
 * or apply a delay.
 *
 * Add a new route by:
 *   1. Adding a new entry to `PATH_TEMPLATES` (or `[id]` placeholders
 *      that the matcher below converts to `*`),
 *   2. Adding the happy-path response in `scenarios/canonical.ts`.
 *
 * WebSocket / SSE handlers (deferred to M3) live in
 * `./websocket.ts` so this file stays a pure REST router.
 */

import { http, HttpResponse, type DefaultBodyType, type PathParams } from 'msw';
import { resolveScenario, extractScenarioName } from '../scenarios';
import { json, type ScenarioContext, type ScenarioName } from '../scenarios/types';
import { getCanonicalResponse } from '../scenarios/canonical';
import { SCENARIO_REGISTRY } from '../scenarios';
import { corsHeaders } from './cors';

/**
 * Convert a path template like `/api/services/[id]` into an MSW
 * matcher pattern. `[id]` → `:id`, and `:id` is what MSW uses for
 * params in v2.
 */
const templated = (path: string): string => path.replace(/\[(\w+)\]/g, ':$1');

/**
 * Build the per-request `ScenarioContext`. Used by both the MSW
 * handler and the SvelteKit `handle` hook.
 */
function buildCtx({
	request,
	params,
	pathTemplate,
}: {
	request: Request;
	params: Record<string, string | readonly string[] | unknown>;
	pathTemplate: string;
}): ScenarioContext {
	const url = new URL(request.url);
	const headers = request.headers;
	const method = request.method.toUpperCase();
	const pathParams: Record<string, string> = {};
	for (const [k, v] of Object.entries(params)) {
		if (typeof v === 'string') pathParams[k] = v;
		else if (Array.isArray(v) && v.length > 0) pathParams[k] = String(v[0]);
	}
	// Body is read async by the handler if needed; for context we
	// only carry the url/method/headers/params. The handler can
	// attach the parsed body via the canonical responder if needed.
	return {
		url,
		method,
		headers,
		body: null,
		pathTemplate,
		pathParams,
	};
}

/**
 * The single MSW handler factory. We register one handler per (path
 * template, method) pair. The handler:
 *   1. Builds a `ScenarioContext` from the incoming Request.
 *   2. Resolves the active scenario from headers/query.
 *   3. If the scenario matches the request, returns its response.
 *   4. Otherwise falls through to the canonical happy response.
 */
function makeHandler(pathTemplate: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE') {
	return http[method.toLowerCase() as 'get'](
		templated(pathTemplate),
		async ({ request, params }) => {
			const ctx = buildCtx({ request, params, pathTemplate });
			// Attempt to read the body once, attach to context for scenarios that need it.
			if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
				try {
					const text = await request.clone().text();
					ctx.body = text ? JSON.parse(text) : null;
				} catch {
					ctx.body = null;
				}
			}
			const scenario = resolveScenario(ctx);
			if (!scenario.matches(ctx)) {
				return HttpResponse.json(getCanonicalResponse(ctx) as Record<string, unknown>, { headers: corsHeaders() });
			}
			const response = await scenario.respond(ctx);
			// Propagate the active scenario as a response header so
			// debug tooling can see which scenario the test is in.
			const headers = new Headers(response.headers);
			headers.set('x-mock-scenario-active', extractScenarioName(ctx));
			headers.set('Access-Control-Allow-Origin', '*');
			headers.set('Access-Control-Allow-Headers', 'x-mock-scenario, content-type, authorization');
			return new HttpResponse(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		},
	);
}

/**
 * The set of all routes the mocks cover. Keep this list in sync
 * with the M1-WS4 `+server.ts` stubs and the E2E matrix's "Mock
 * API Scenario" column.
 *
 * Adding a route here is the **only** place a path is wired up to
 * the mock layer; everything else is data.
 */
const ROUTES: ReadonlyArray<{
	path: string;
	methods: ReadonlyArray<'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'>;
}> = [
	// Auth (PB-1 fix: requireAdmin on /api/approvals POST; M1-WS4)
	{ path: '/api/auth', methods: ['GET', 'POST', 'DELETE'] },
	{ path: '/api/auth/password', methods: ['POST'] },

	// Services
	{ path: '/api/services', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
	{ path: '/api/services/[id]', methods: ['GET', 'PATCH', 'DELETE'] },
	{ path: '/api/services/[id]/badges', methods: ['GET', 'PUT'] },
	{ path: '/api/services/[id]/health', methods: ['GET', 'POST'] },
	{ path: '/api/admin/services', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },

	// System / host
	{ path: '/api/system', methods: ['GET'] },
	{ path: '/api/network', methods: ['GET'] },
	{ path: '/api/processes', methods: ['GET'] },

	// Docker
	{ path: '/api/docker', methods: ['GET'] },
	{ path: '/api/docker/networks', methods: ['GET'] },
	{ path: '/api/docker/actions', methods: ['POST'] },
	{ path: '/api/docker/[id]', methods: ['GET'] },

	// Incus
	{ path: '/api/incus', methods: ['GET'] },
	{ path: '/api/incus/settings', methods: ['GET', 'PUT'] },
	{ path: '/api/incus/images', methods: ['GET'] },
	{ path: '/api/incus/instances', methods: ['GET', 'POST'] },
	{ path: '/api/incus/instances/[name]', methods: ['GET', 'DELETE'] },
	{ path: '/api/incus/instances/[name]/validate', methods: ['POST'] },
	{ path: '/api/incus/instances/[name]/provision', methods: ['POST'] },
	{ path: '/api/incus/instances/[name]/provision/status', methods: ['GET'] },
	{ path: '/api/incus/[name]', methods: ['GET'] },
	{ path: '/api/incus/[name]/shell', methods: ['POST'] },
	{ path: '/api/incus/actions', methods: ['POST'] },
	{ path: '/api/incus/ai/analyze', methods: ['POST'] },
	{ path: '/api/incus/ai/models', methods: ['GET'] },

	// Systemd
	{ path: '/api/systemd', methods: ['GET'] },
	{ path: '/api/systemd/actions', methods: ['POST'] },

	// Alerts
	{ path: '/api/alerts', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
	{ path: '/api/alerts/[id]', methods: ['PATCH', 'DELETE'] },
	{ path: '/api/alerts/operational', methods: ['GET'] },

	// Audit (M0-E SR: chain integrity, two-phase DCA lifecycle)
	{ path: '/api/audit', methods: ['GET'] },
	{ path: '/api/audit/verify', methods: ['GET'] },
	{ path: '/api/dashboard_command_audit', methods: ['GET', 'POST', 'PATCH'] },

	// Approvals (PB-1: requireAdmin; approval-token flow)
	{ path: '/api/approvals', methods: ['GET', 'POST'] },

	// Admin: users / badges / projects / agents / mail
	{ path: '/api/admin/users', methods: ['GET'] },
	{ path: '/api/badges', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
	{ path: '/api/projects', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
	{ path: '/api/agents', methods: ['GET'] },
	{ path: '/api/agents/[slug]/files', methods: ['GET'] },
	{ path: '/api/agents/[slug]/files/[filename]', methods: ['GET'] },
	{ path: '/api/mail-guardian', methods: ['GET'] },
	{ path: '/api/mail-guardian/accounts', methods: ['GET'] },
	{ path: '/api/mail-guardian/reviews', methods: ['GET', 'POST'] },

	// Backups (M0-B gap: NOT IMPLEMENTED in M0; M1 mocks the empty case)
	{ path: '/api/backups', methods: ['GET'] },
	{ path: '/api/scheduler', methods: ['GET'] },

	// Health / env-browser / layout / root-helper / chat-sessions / ai
	{ path: '/api/health', methods: ['GET'] },
	{ path: '/api/env-browser', methods: ['GET', 'POST'] },
	{ path: '/api/layout', methods: ['GET'] },
	{ path: '/api/root-helper/commands', methods: ['GET'] },
	{ path: '/api/chat-sessions', methods: ['GET'] },
	{ path: '/api/ai/chat', methods: ['POST'] },

	// Terminal (PB-2: allowlist; M3 SSE)
	{ path: '/api/terminal', methods: ['POST', 'GET'] },
];

/** Build the full MSW handler list. */
export const handlers = ROUTES.flatMap((route) => route.methods.map((m) => makeHandler(route.path, m)));

/** For tests/debugging: which scenarios are registered. */
export const knownScenarios = Object.keys(SCENARIO_REGISTRY) as ScenarioName[];

// Re-export types so handlers/* files can type their params.
export type { DefaultBodyType, PathParams };
export { json as toJson, HttpResponse };
