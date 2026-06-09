/**
 * /audit — list of audit events, with URL-driven filters.
 *
 * Filter URL parameters (all optional):
 *   ?actor=alice   — substring match on actor
 *   ?surface=auth  — exact match on source
 *   ?action=auth.login — exact match on event_type
 *   ?result=success — one of success|failure|denied|error
 *   ?since=ISO8601 — occurred_at >= since
 *   ?until=ISO8601 — occurred_at <= until
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db/client';
import { listAuditEvents } from '$lib/server/db/repos/audit_events';
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

	return { actor, surface, action, result, since: sinceParam, until: untilParam };
}

/** Client-side result filter (audit_log table does not store result). */
function applyResultFilter(rows: AuditEvent[], result: string | null): AuditEvent[] {
	if (!result) return rows;
	return rows.filter((e) => e.result === result);
}

export const load: PageServerLoad = async ({ url }) => {
	const filters = parseFilters(url);
	const db = getDb();
	const { rows } = await listAuditEvents(db, {
		actor: filters.actor || undefined,
		surface: filters.surface || undefined,
		action: filters.action || undefined,
		since: filters.since || undefined,
		until: filters.until || undefined,
		pageSize: 500,
	});
	const filtered = applyResultFilter(rows, filters.result);

	const surfaceSet = new Set<string>();
	const actionSet = new Set<string>();
	for (const e of filtered) {
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
