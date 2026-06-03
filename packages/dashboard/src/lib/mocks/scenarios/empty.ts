/**
 * `empty` scenario — every list endpoint returns `{ items: [] }`.
 *
 * Used by the matrix's "Empty state" rows (DOCKER-EMPTY, INCUS-EMPTY,
 * PROCESS-EMPTY, etc.) to exercise the UI's empty-state branches
 * (EmptyState component, "No results" copy).
 *
 * Walk strategy: if the canonical response is an object with any
 * array property, replace each array with `[]`. Otherwise return the
 * canonical response unchanged (so non-list endpoints still respond
 * normally).
 */

import { getCanonicalResponse } from './canonical';
import { json, type Scenario, type ScenarioContext } from './types';

const emptyArrays = (value: unknown): unknown => {
	if (Array.isArray(value)) return [];
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = emptyArrays(v);
		}
		return out;
	}
	return value;
};

const empty: Scenario = {
	name: 'empty',
	description: 'Every list endpoint returns an empty array. Object bodies are kept.',
	matches: () => true,
	respond: (ctx: ScenarioContext) => json(emptyArrays(getCanonicalResponse(ctx))),
};

export default empty;
