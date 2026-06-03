/**
 * `slow` scenario — 1.5s delay on every response.
 *
 * Used by APPS-014 (skeleton loading) and any row that needs to
 * exercise the loading state without an outright timeout. The delay
 * is the matrix's "prove loading state" sentinel.
 */

import { sleep, json, SLOW_LATENCY_MS, type Scenario, type ScenarioContext } from './types';
import { getCanonicalResponse } from './canonical';

const slow: Scenario = {
	name: 'slow',
	description: '1.5s pre-response delay (proves loading skeletons).',
	delayMs: SLOW_LATENCY_MS,
	matches: () => true,
	respond: async (ctx: ScenarioContext) => {
		await sleep(SLOW_LATENCY_MS);
		return json(getCanonicalResponse(ctx));
	},
};

export default slow;
