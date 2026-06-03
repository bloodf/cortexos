/**
 * `happy` scenario — normal responses, all services online.
 *
 * This is the default scenario. The browser MSW worker and the
 * SvelteKit `handle` hook both fall through to `getCanonicalResponse`
 * when the active scenario is `happy`.
 *
 * Every other scenario must produce responses that are still
 * Zod-parseable against the same entity schemas (or be a typed error
 * envelope).
 */

import { getCanonicalResponse } from './canonical';
import { json, type Scenario, type ScenarioContext } from './types';

const happy: Scenario = {
	name: 'happy',
	description: 'Canonical happy-path responses; all services online; default scenario.',
	matches: () => true,
	respond: (ctx: ScenarioContext) => json(getCanonicalResponse(ctx)),
};

export default happy;
