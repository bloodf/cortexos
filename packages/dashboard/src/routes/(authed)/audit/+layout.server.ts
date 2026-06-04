import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Admin gate for the (authed)/audit route group.
 *
 * Per THREAT_MODEL §6, audit data may include IPs and sensitive payloads,
 * so the entire audit surface is admin-only. Non-admins get a 403
 * (rendered by `+error.svelte` in the authed group). Anonymous users
 * are caught by the parent (authed) layout and bounced to /login with
 * `?next=/audit/...`.
 */
export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		const next = encodeURIComponent(url.pathname + url.search);
		throw redirect(303, `/login?next=${next}`);
	}
	if (!locals.user.isAdmin) {
		throw error(403, 'Admin access required');
	}
	return {};
};
