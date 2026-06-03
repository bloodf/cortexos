/**
 * /audit — list of audit events, with URL-driven filters.
 *
 * Filter URL parameters (all optional):
 *   ?actor=alice   — substring match on actorUserId
 *   ?surface=auth  — exact match on surface
 *   ?action=auth.login — exact match on action
 *   ?result=success — one of success|failure|denied|error
 *   ?since=ISO8601 — createdAt >= since
 *   ?until=ISO8601 — createdAt <= until
 *
 * The page is admin-gated by the route group's +layout.server.ts.
 * Per THREAT_MODEL §6, audit data may include IPs and sensitive payloads.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listAudit } from '$lib/server/audit';
import type { AuditEvent } from '$lib/server/entities';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function parseFilters(url: URL) {
	const actor = url.searchParams.get('actor')?.trim() ?? '';
	const surface = url.searchParams.get('surface')?.trim() ?? '';
	const action = url.searchParams.get('action')?.trim() ?? '';
	const resultParam = url.searchParams.get('result')?.trim() ?? '';
	const sinceParam = url.searchParams.get('since')?.trim() ?? '';
	const untilParam = url.searchParams.get('until')?.trim() ?? '';

	const result: 'success' | 'failure' | 'denied' | 'error' | null =
		resultParam === 'success' ||
		resultParam === 'failure' ||
		resultParam === 'denied' ||
		resultParam === 'error'
			? resultParam
			: null;

	if (sinceParam && !ISO_DATE.test(sinceParam)) {
		throw error(400, 'Invalid `since` — expected ISO 8601');
	}
	if (untilParam && !ISO_DATE.test(untilParam)) {
		throw error(400, 'Invalid `until` — expected ISO 8601');
	}

	const since = sinceParam ? new Date(sinceParam).toISOString() : null;
	const until = untilParam ? new Date(untilParam).toISOString() : null;

	return { actor, surface, action, result, since, until };
}

function applyFilters(
	all: ReadonlyArray<AuditEvent>,
	f: ReturnType<typeof parseFilters>,
): AuditEvent[] {
	let out: AuditEvent[] = all.slice().reverse(); // most recent first
	if (f.actor) out = out.filter((e) => (e.actorUserId ?? '').includes(f.actor));
	if (f.surface) out = out.filter((e) => e.surface === f.surface);
	if (f.action) out = out.filter((e) => e.action === f.action);
	if (f.result) out = out.filter((e) => e.result === f.result);
	if (f.since) out = out.filter((e) => e.createdAt >= f.since!);
	if (f.until) out = out.filter((e) => e.createdAt <= f.until!);
	return out;
}

export const load: PageServerLoad = async ({ url }) => {
	const filters = parseFilters(url);
	const all = listAudit();
	const filtered = applyFilters(all, filters);

	// Distinct values for the filter dropdowns.
	const surfaceSet = new Set<string>();
	const actionSet = new Set<string>();
	for (const e of all) {
		surfaceSet.add(e.surface);
		actionSet.add(e.action);
	}

	return {
		events: filtered,
		filters,
		surfaces: Array.from(surfaceSet).sort(),
		actions: Array.from(actionSet).sort(),
		exportUrl: `/audit/export${url.search}`,
	};
};
