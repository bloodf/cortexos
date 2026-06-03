/**
 * `timeout` scenario — 10s delay.
 *
 * Used by the matrix's "timeout UI" rows (DOCKER-START-ERR-014, etc.)
 * to prove the client UI surfaces a timeout correctly. In a real
 * network, the fetch would be aborted by AbortController; here the
 * server simply holds the response long enough for the client to give
 * up. Vitest tests use `fake timers` to advance the clock; Playwright
 * tests use a smaller `page.setDefaultTimeout`.
 */

import { sleep, json, TIMEOUT_LATENCY_MS, type Scenario, type ScenarioContext } from './types';
import { getCanonicalResponse } from './canonical';

const timeout: Scenario = {
	name: 'timeout',
	description: '10s pre-response delay (proves timeout UI).',
	delayMs: TIMEOUT_LATENCY_MS,
	matches: () => true,
	respond: async (ctx: ScenarioContext) => {
		await sleep(TIMEOUT_LATENCY_MS);
		return json(getCanonicalResponse(ctx));
	},
};

export default timeout;
