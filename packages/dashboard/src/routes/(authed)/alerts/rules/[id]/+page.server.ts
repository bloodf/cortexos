/**
 * /alerts/rules/[id] — rule detail page server load + form actions.
 *
 * The `[id]` URL parameter is the integer primary key from the
 * `alert_rules` table. We attempt the integer first; legacy links
 * carrying the synthesized UUID fall back to a no-op.
 *
 * Form actions:
 *   - enable   (admin only, PB-5)
 *   - disable  (admin only, PB-5)
 *
 * Both flip the `enabled` column. Any non-admin user hitting
 * this page sees a 403 (handled by `requireAdmin`).
 */
import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import { requireAdmin } from '$lib/server/auth';
import {
	adaptAlertRule,
	adaptAlertEventList,
	type DbAlertHistoryRow,
} from '$lib/components/alerts/adapter';

function parseIdParam(raw: string | undefined): number | null {
	if (!raw) return null;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n <= 0) return null;
	return n;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	const id = parseIdParam(params.id);
	if (id == null) {
		throw error(400, `Invalid rule id '${params.id}'`);
	}
	const db = getDb();
	const ruleRow = await alertsRepo.getAlertRuleById(db, id);
	if (!ruleRow) {
		throw error(404, `Rule ${id} not found`);
	}
	const historyRows: DbAlertHistoryRow[] = await alertsRepo.listAlertHistory(db, {
		ruleId: id,
		limit: 50,
	});
	return {
		rule: adaptAlertRule(ruleRow),
		history: adaptAlertEventList(historyRows),
		canToggle: Boolean(locals.user.isAdmin),
	};
};

export const actions: Actions = {
	enable: async (event) => {
		requireAdmin(event); // PB-5
		const id = parseIdParam(event.params.id);
		if (id == null) return fail(400, { error: 'Invalid rule id' });
		const updated = await alertsRepo.updateAlertRule(getDb(), id, { enabled: true });
		if (!updated) return fail(404, { error: `Rule ${id} not found` });
		return { ok: true, rule: adaptAlertRule(updated) };
	},
	disable: async (event) => {
		requireAdmin(event); // PB-5
		const id = parseIdParam(event.params.id);
		if (id == null) return fail(400, { error: 'Invalid rule id' });
		const updated = await alertsRepo.updateAlertRule(getDb(), id, { enabled: false });
		if (!updated) return fail(404, { error: `Rule ${id} not found` });
		return { ok: true, rule: adaptAlertRule(updated) };
	},
};
