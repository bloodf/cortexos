/**
 * /alerts — index page server load.
 *
 * Returns three slices for the tabs:
 *   - rules:        all alert rules (rule-based)
 *   - operational:  the most recent operational alerts
 *   - history:      the most recent rule firings
 *
 * Filters: ?severity (operational only) and ?status (rules: enabled
 * | disabled | all; operational: acknowledged | unacknowledged | all).
 *
 * Data source: the Drizzle repos under `$lib/server/db/repos/alerts`.
 * We do NOT add a parallel mock layer — the repos are the source
 * of truth and the contracts types are produced by the adapter in
 * `$lib/components/alerts/adapter.ts`.
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import {
	adaptAlertRuleList,
	adaptAlertEventList,
	adaptOperationalAlertList,
} from '$lib/components/alerts/adapter';
import type { AlertRule, AlertEvent, OperationalAlert, AlertSeverity } from '@cortexos/contracts';

const SEVERITIES = new Set<AlertSeverity>(['info', 'warning', 'critical']);

function parseSeverity(raw: string | null): AlertSeverity | null {
	if (!raw) return null;
	if (SEVERITIES.has(raw as AlertSeverity)) return raw as AlertSeverity;
	return null;
}

type StatusFilter = 'all' | 'enabled' | 'disabled';
type AckFilter = 'all' | 'unacknowledged' | 'acknowledged';

function parseRuleStatus(raw: string | null): StatusFilter {
	if (raw === 'enabled' || raw === 'disabled') return raw;
	return 'all';
}

function parseAckStatus(raw: string | null): AckFilter {
	if (raw === 'unacknowledged' || raw === 'acknowledged') return raw;
	return 'all';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	// Require any authenticated user. The (authed) layout already
	// enforces this, but we re-check here for defense in depth.
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const db = getDb();

	const ruleStatus = parseRuleStatus(url.searchParams.get('status'));
	const ackStatus = parseAckStatus(url.searchParams.get('status'));
	const severityFilter = parseSeverity(url.searchParams.get('severity'));

	// Rules: optional `enabledOnly` filter.
	const rulesRaw = await alertsRepo.listAlertRules(
		db,
		ruleStatus === 'enabled' ? { enabledOnly: true } : {},
	);
	// For 'disabled' we filter in-memory (the repo only supports enabledOnly).
	const rules: AlertRule[] = adaptAlertRuleList(
		ruleStatus === 'disabled' ? rulesRaw.filter((r) => !r.enabled) : rulesRaw,
	);

	// Operational: severity + acknowledgement filter.
	// Severity filter is applied AFTER adapt: the URL uses the
	// contracts severity ('info'|'warning'|'critical') but the
	// repo's `severity` parameter takes a DB severity value
	// ('info'|'warn'|'error'|'critical'). Filtering at the
	// contracts level keeps the page logic simple.
	const operationalRaw = await alertsRepo.listOperationalAlerts(db, {
		unacknowledgedOnly: ackStatus === 'unacknowledged',
		limit: 500,
	});
	const operationalAll = adaptOperationalAlertList(operationalRaw);
	const operational: OperationalAlert[] = [];
	for (const a of operationalAll) {
		if (!severityFilter || a.severity === severityFilter) operational.push(a);
	}

	// History: last 100 firings, newest first.
	const historyRaw = await alertsRepo.listAlertHistory(db, {
		limit: 100,
	});
	const history: AlertEvent[] = adaptAlertEventList(historyRaw);

	return {
		rules,
		operational,
		history,
		filters: {
			severity: severityFilter,
			ruleStatus,
			ackStatus,
		},
		// Re-expose the role flag so the page can show admin-only CTAs.
		canManageRules: Boolean(locals.user.isAdmin),
	};
};
