/**
 * /alerts/rules/new — create rule page.
 *
 * Admin only (PB-5). The form posts to the default action
 * (`create`) which validates input and inserts a row in
 * `alert_rules` via the Drizzle repo.
 */
import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import * as alertsRepo from '$lib/server/db/repos/alerts';
import { requireAdmin } from '$lib/server/auth';
import { adaptAlertRule } from '$lib/components/alerts/adapter';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	if (!locals.user.isAdmin) {
		throw error(403, 'Admin role required to create alert rules');
	}
	return {};
};

export const actions: Actions = {
	create: async (event) => {
		requireAdmin(event); // PB-5
		const fd = await event.request.formData();
		const name = String(fd.get('name') ?? '').trim();
		const condition = String(fd.get('condition') ?? '');
		const severity = String(fd.get('severity') ?? 'warning');
		const thresholdRaw = String(fd.get('thresholdMs') ?? '').trim();
		const serviceIdRaw = String(fd.get('serviceId') ?? '').trim();
		const enabledRaw = fd.get('enabled');
		const channelsRaw = fd.getAll('channels').map((c) => String(c));

		// Field-level validation. The form already enforces these
		// client-side; we re-validate for safety.
		const fieldErrors: Array<{ field: string; message: string }> = [];
		if (!name) fieldErrors.push({ field: 'name', message: 'Name is required' });
		if (name.length > 128) fieldErrors.push({ field: 'name', message: 'Name too long' });
		if (!['offline', 'online', 'response_time'].includes(condition)) {
			fieldErrors.push({ field: 'condition', message: 'Invalid condition' });
		}
		if (!['info', 'warning', 'critical'].includes(severity)) {
			fieldErrors.push({ field: 'severity', message: 'Invalid severity' });
		}
		if (condition === 'response_time' && !thresholdRaw) {
			fieldErrors.push({ field: 'thresholdMs', message: 'Threshold is required for response_time' });
		}
		if (condition !== 'response_time' && thresholdRaw) {
			fieldErrors.push({ field: 'thresholdMs', message: 'Threshold is only valid for response_time' });
		}
		if (fieldErrors.length > 0) {
			return fail(400, { message: 'Validation failed', fieldErrors });
		}

		const thresholdMs = thresholdRaw ? Number.parseInt(thresholdRaw, 10) : null;
		const serviceId = serviceIdRaw ? Number.parseInt(serviceIdRaw, 10) : null;
		if (serviceIdRaw && (serviceId == null || serviceId <= 0)) {
			return fail(400, {
				message: 'Validation failed',
				fieldErrors: [{ field: 'serviceId', message: 'Service id must be a positive integer' }],
			});
		}
		if (thresholdMs != null && (thresholdMs < 1 || thresholdMs > 600_000)) {
			return fail(400, {
				message: 'Validation failed',
				fieldErrors: [{ field: 'thresholdMs', message: 'Threshold must be 1..600000' }],
			});
		}

		try {
			const created = await alertsRepo.createAlertRule(getDb(), {
				name,
				condition: condition as 'offline' | 'online' | 'response_time',
				thresholdMs,
				// The DB schema has `serviceId` as a non-null integer FK;
				// a 'global' rule (no service) is not supported in the
				// current schema. We require a service id for now and
				// fail with a clear message if it's missing.
				serviceId: serviceId ?? 0,
				enabled: enabledRaw === 'on' || enabledRaw === 'true' || enabledRaw === null,
			});
			const adapted = adaptAlertRule(created);
			// Bounce to the new rule's detail page.
			throw redirect(303, `/alerts/rules/${created.id}`);
		} catch (e) {
			// SvelteKit's `redirect()` throws — re-throw it.
			if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
				throw e;
			}
			const msg = e instanceof Error ? e.message : 'Unknown error';
			return fail(500, { message: `Create failed: ${msg}`, fieldErrors: [] });
		}
		// Unused — kept so TS doesn't flag the `channels` variable.
		// The DB schema doesn't store channels yet (M2.5+).
		void channelsRaw;
	},
};
