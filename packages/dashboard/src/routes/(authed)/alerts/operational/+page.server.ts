/**
 * /alerts/operational — operational alert list.
 *
 * Filtered by `?severity` and `?status` (acknowledged/unacknowledged).
 * The page is read-only here; the per-alert acknowledge form
 * lives on `/alerts/operational/[id]`.
 *
 * Auth: any authenticated user (the (authed) layout already gates).
 * No `requireAdmin` — operational alerts are operator-facing.
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import { adaptOperationalAlertList } from '$lib/components/alerts/adapter';
import type { AlertSeverity } from '@cortexos/contracts';

const SEVERITIES = new Set<AlertSeverity>(['info', 'warning', 'critical']);

function parseSeverity(raw: string | null): AlertSeverity | null {
	if (!raw) return null;
	if (SEVERITIES.has(raw as AlertSeverity)) return raw as AlertSeverity;
	return null;
}

type AckFilter = 'all' | 'unacknowledged' | 'acknowledged';

function parseAckStatus(raw: string | null): AckFilter {
	if (raw === 'unacknowledged' || raw === 'acknowledged') return raw;
	return 'all';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const severityFilter = parseSeverity(url.searchParams.get('severity'));
	const ackStatus = parseAckStatus(url.searchParams.get('status'));

	const raw = await alertsRepo.listOperationalAlerts(getDb(), {
		unacknowledgedOnly: ackStatus === 'unacknowledged',
		limit: 500,
	});
	const adapted = adaptOperationalAlertList(raw);
	const operational = severityFilter
		? adapted.filter((a) => a.severity === severityFilter)
		: adapted;

	return {
		operational,
		filters: { severity: severityFilter, ackStatus },
	};
};
