/**
 * Public API for the mocks layer.
 *
 * Importing this module in **production** triggers the
 * `enforceMockMode` guard (Layer 1+2 of the prod-leak guard).
 * Tests and E2E/dev mode are fine.
 *
 * Typical consumers:
 *
 *   // SvelteKit hooks.server.ts
 *   import { installMockHandleFromEnv } from '$lib/mocks';
 *   export const handle = sequence(installMockHandleFromEnv(), authHandle);
 *
 *   // Playwright fixture
 *   import { listScenarios, setScenario, getScenario } from '$lib/mocks';
 *   await setScenario(page, 'empty');
 *
 *   // Test code
 *   import { makeService, makeAdminUser } from '$lib/mocks/fixtures';
 *
 *   // Scenario registry
 *   import { SCENARIO_REGISTRY } from '$lib/mocks/scenarios';
 */

import { enforceMockMode } from './prod-leak-guard';

enforceMockMode('index');

// ── Layer 1: scenario catalog (used by both MSW + server) ──────────
export {
	SCENARIO_NAMES,
	SCENARIO_REGISTRY,
	listScenarios,
	isScenarioName,
	resolveScenario,
	extractScenarioName,
} from './scenarios';

export type { Scenario, ScenarioContext, ScenarioName } from './scenarios/types';
export { SLOW_LATENCY_MS, TIMEOUT_LATENCY_MS, json, errorResponse, sleep } from './scenarios/types';
export { getCanonicalResponse } from './scenarios/canonical';
export { paginate, pageInputSchema } from './contracts/query';
export type { Page, PageInput, SortDir } from './contracts/query';

// ── Contracts ──────────────────────────────────────────────────────
export * from './contracts';

// ── Fixtures ───────────────────────────────────────────────────────
export * as fixtures from './fixtures';

// ── Handlers ───────────────────────────────────────────────────────
export { handlers as mswHandlers, knownScenarios } from './handlers';

// ── Server-side hooks ──────────────────────────────────────────────
export { installMockHandle, installMockHandleFromEnv } from './server';
export type { MockHandleOptions } from './server';

// ── Browser-side MSW worker ────────────────────────────────────────
export { worker as mswWorker } from './browser';

// ── Prod-leak guard (for tests and CI) ─────────────────────────────
export {
	enforceMockMode,
	assertMocksNeverRunInProduction,
	ALLOWED_MOCKS_IMPORTERS,
	isAllowedMocksImporter,
} from './prod-leak-guard';
