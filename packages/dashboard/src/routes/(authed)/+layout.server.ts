import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Auth gate for the entire (authed) route group. M1-WS2 sends
 * anonymous users to /login. The M1-WS5-mock-api hook will swap
 * this for a real cookie + DB lookup.
 */
export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		const next = encodeURIComponent(url.pathname + url.search);
		throw redirect(303, `/login?next=${next}`);
	}
	return {};
};
