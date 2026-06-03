/**
 * Scenario types — the canonical list of E2E mock scenarios.
 *
 * Mapped to the E2E coverage matrix (M0-C) and the MOCK_API_INVENTORY
 * (M0-B). The matrix's "Mock API Scenario" column is the source of
 * truth for which scenario a given row uses.
 *
 * | Scenario      | Purpose                                         | Response |
 * |---------------|-------------------------------------------------|----------|
 * | happy         | Normal data, all services online                | 200 + canonical payload |
 * | empty         | No data (empty arrays, no rows)                 | 200 + `{ items: [] }` |
 * | error         | Server-side 5xx                                 | 500 + INTERNAL_ERROR |
 * | denied        | Auth/permission 401/403                         | 401/403 + AUTH_ERROR / PERMISSION_DENIED |
 * | slow          | 1.5s delay (proves loading state)               | 200 + canonical payload after 1.5s |
 * | timeout       | 10s delay (proves timeout UI)                   | 200 + canonical payload after 10s (server holds) |
 * | destructive   | Requires approval + audit row (PROMPT)          | 403 + APPROVAL_REQUIRED |
 * | approval      | Approval-request body shape                     | 200 + canonical payload (the approval row) |
 * | denied-rbac   | Standard user hitting admin endpoint            | 403 + PERMISSION_DENIED |
 * | denied-rht-2fa| RHT (real-host test) requires 2FA               | 401 + RHT_2FA_REQUIRED |
 * | denied-mfa    | MFA required                                     | 401 + MFA_REQUIRED |
 * | audit-fail    | Audit chain invalid                             | 500 + AUDIT_CHAIN_INVALID |
 *
 * New scenarios are added by:
 *   1. extending the union below,
 *   2. adding a file in `./scenarios/<name>.ts` exporting a default
 *      `Scenario`,
 *   3. registering it in `./scenarios/index.ts`.
 */

import { errorStatusMap, type CortexError } from '../contracts/errors';

export const SCENARIO_NAMES = [
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
] as const;
export type ScenarioName = (typeof SCENARIO_NAMES)[number];

/** Default latency applied to the `slow` scenario (1.5s). */
export const SLOW_LATENCY_MS = 1500;

/** Default latency applied to the `timeout` scenario (10s). */
export const TIMEOUT_LATENCY_MS = 10_000;

/**
 * A `Scenario` is a self-contained description of how a route should
 * respond under a given scenario name. The `matches` predicate picks
 * the right scenario for a given request, and `respond` builds the
 * `Response`. Both run in the browser (MSW) and on the server
 * (hooks.server.ts).
 */
export interface ScenarioContext {
	/** The URL of the request, including query string. */
	url: URL;
	/** The HTTP method (uppercase). */
	method: string;
	/** The request headers (lower-cased keys). */
	headers: Headers;
	/** The parsed JSON body, or `null` if no body or unparsable. */
	body: unknown;
	/** The route's path template (e.g. `/api/services/[id]`). */
	pathTemplate: string;
	/** Path parameters extracted from the route template. */
	pathParams: Record<string, string>;
}

export interface Scenario {
	readonly name: ScenarioName;
	readonly description: string;
	/** Return true if this scenario applies to the given request. */
	matches(ctx: ScenarioContext): boolean;
	/** Build the response for this request under this scenario. */
	respond(ctx: ScenarioContext): Response | Promise<Response>;
	/** Optional pre-applied latency in milliseconds. */
	readonly delayMs?: number;
}

/** Helper: build a JSON response with a body. */
export function json(body: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	headers.set('Content-Type', 'application/json');
	return new Response(JSON.stringify(body), { ...init, headers });
}

/** Helper: build an error response from a CortexError. */
export function errorResponse(err: CortexError): Response {
	const status = errorStatusMap[err.code];
	return json(err, { status });
}

/** Helper: sleep for `ms` milliseconds, returning a passthrough. */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
