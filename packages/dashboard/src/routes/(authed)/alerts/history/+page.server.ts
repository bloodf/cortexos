/**
 * /alerts/history — rule firings timeline.
 *
 * Filterable by rule id (`?ruleId=`) and service id (`?serviceId=`).
 * Read-only — no actions on this page.
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import { adaptAlertEventList } from '$lib/components/alerts/adapter';

function parseIntParam(name: string, value: string | null): number | null {
	if (!value) return null;
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n <= 0) return null;
	return n;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	const ruleId = parseIntParam('ruleId', url.searchParams.get('ruleId'));
	const serviceId = parseIntParam('serviceId', url.searchParams.get('serviceId'));
	const events = adaptAlertEventList(
		await alertsRepo.listAlertHistory(getDb(), {
			ruleId: ruleId ?? undefined,
			serviceId: serviceId ?? undefined,
			limit: 200,
		}),
	);
	return {
		events,
		filters: { ruleId, serviceId },
	};
};
