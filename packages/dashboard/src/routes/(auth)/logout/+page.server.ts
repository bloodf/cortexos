import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * /logout — clears the session cookie and bounces to /login.
 * Real session teardown (DB delete + cookie clear) lands in
 * M1-WS4-backend-skeleton + M3. For M1 we simply drop the cookie.
 */
export const load: PageServerLoad = () => {
	throw redirect(303, '/login');
};

export const actions: Actions = {
	default: async ({ cookies }) => {
		cookies.delete('session_token', { path: '/' });
		throw redirect(303, '/login');
	}
};
