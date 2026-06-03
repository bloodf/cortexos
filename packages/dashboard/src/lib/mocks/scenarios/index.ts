/**
 * Scenario registry + per-request resolver.
 *
 * Exports `resolveScenario(ctx)` which:
 *   1. Reads the scenario from the `x-mock-scenario` header (set by
 *      Playwright fixtures or by `setScenario()`), or from the
 *      `?scenario=…` query param.
 *   2. Returns the matching `Scenario` (defaulting to `happy`).
 *   3. Falls through to `happy` for unknown names.
 *
 * The same registry is used by the browser MSW worker and the
 * SvelteKit `handle` hook, so the E2E scenario switch is uniform
 * across both layers.
 */

import happy from './happy';
import empty from './empty';
import error from './error';
import denied from './denied';
import slow from './slow';
import timeout from './timeout';
import destructive from './destructive';
import approval from './approval';
import deniedRbac from './denied-rbac';
import deniedRht2fa from './denied-rht-2fa';
import deniedMfa from './denied-mfa';
import auditFail from './audit-fail';
import { SCENARIO_NAMES, type Scenario, type ScenarioContext, type ScenarioName } from './types';

// Re-export the SCENARIO_NAMES tuple so callers can iterate it
// without going through `listScenarios()`.
export { SCENARIO_NAMES };
export type { Scenario, ScenarioContext, ScenarioName };

export const SCENARIO_REGISTRY: Record<ScenarioName, Scenario> = {
	happy,
	empty,
	error,
	denied,
	slow,
	timeout,
	destructive,
	approval,
	'denied-rbac': deniedRbac,
	'denied-rht-2fa': deniedRht2fa,
	'denied-mfa': deniedMfa,
	'audit-fail': auditFail,
} as const;

export function listScenarios(): ScenarioName[] {
	return [...SCENARIO_NAMES];
}

export function isScenarioName(value: unknown): value is ScenarioName {
	return typeof value === 'string' && (SCENARIO_NAMES as readonly string[]).includes(value);
}

/**
 * Extract the active scenario from request metadata. The header
 * takes priority; the query param is a fallback for browser tests
 * that can change URL but not headers.
 */
export function extractScenarioName(ctx: Pick<ScenarioContext, 'headers' | 'url'>): ScenarioName {
	const headerName = ctx.headers.get('x-mock-scenario') ?? ctx.headers.get('X-Mock-Scenario');
	if (isScenarioName(headerName)) return headerName;
	const paramName = ctx.url.searchParams.get('scenario');
	if (isScenarioName(paramName)) return paramName;
	return 'happy';
}

/**
 * Resolve the active scenario for a request and return it. The
 * returned `Scenario` knows how to build the response.
 */
export function resolveScenario(ctx: ScenarioContext): Scenario {
	const name = extractScenarioName(ctx);
	return SCENARIO_REGISTRY[name];
}
