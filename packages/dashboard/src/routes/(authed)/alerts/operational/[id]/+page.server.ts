/**
 * /alerts/operational/[id] — operational alert detail + ack action.
 *
 * Auth: any authenticated user can ack (no admin gate, per the
 * task spec — ops folks who aren't admins still need to clear the
 * queue). The (authed) layout already enforces auth.
 *
 * The `[id]` URL parameter is the integer primary key from the
 * `alerts` table. The synthesized UUID is accepted too; the
 * adapter looks up the row by id and falls back gracefully.
 */
import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import { requireAuth } from '$lib/server/auth';
import { adaptOperationalAlert } from '$lib/components/alerts/adapter';

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
		throw error(400, `Invalid operational alert id '${params.id}'`);
	}
	const row = await alertsRepo.getOperationalAlertById(getDb(), id);
	if (!row) {
		throw error(404, `Operational alert ${id} not found`);
	}
	return { alert: adaptOperationalAlert(row) };
};

export const actions: Actions = {
	acknowledge: async (event) => {
		requireAuth(event); // any authed user can ack.
		const id = parseIdParam(event.params.id);
		if (id == null) return fail(400, { error: 'Invalid alert id' });
		const updated = await alertsRepo.acknowledgeOperationalAlert(getDb(), id);
		if (!updated) {
			// Either the row doesn't exist or it was already acked.
			// Re-fetch to give the client a clear answer.
			const current = await alertsRepo.getOperationalAlertById(getDb(), id);
			if (!current) return fail(404, { error: `Alert ${id} not found` });
			return { ok: true, alert: adaptOperationalAlert(current) };
		}
		return { ok: true, alert: adaptOperationalAlert(updated) };
	},
};
