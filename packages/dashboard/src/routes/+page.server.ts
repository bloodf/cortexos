import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Root redirect. The SvelteKit app does not use locale-prefixed routes
 * (see §8.15 of the architecture audit), so `/` always lands on
 * `/dashboard`. An anonymous user is bounced to `/login` first.
 */
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	throw redirect(303, '/dashboard');
};
