import { fail, redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import type { Actions, PageServerLoad } from './$types';

const LoginSchema = v.object({
	username: v.pipe(v.string(), v.minLength(1, 'Username is required.')),
	password: v.pipe(v.string(), v.minLength(1, 'Password is required.'))
});

/**
 * /login loader. M1 sends every visitor to the login form; the actual
 * PAM wiring lands in M1-WS4-backend-skeleton. Until then, the form
 * action returns 401 (see below) — we just present the form.
 */
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		// Only set on the server so the client cannot tamper with it.
		locals.requestId; // touch to silence unused-var lint; the field is part of the contract
		const form = await request.formData();
		const raw = {
			username: String(form.get('username') ?? ''),
			password: String(form.get('password') ?? '')
		};
		const parsed = v.safeParse(LoginSchema, raw);
		if (!parsed.success) {
			return fail(400, {
				username: raw.username,
				error: 'required' as const
			});
		}
		// Real PAM auth lands in M1-WS4-backend-skeleton + M3. Until
		// then the M1 shell returns 401 to make the wiring visible.
		return fail(401, {
			username: raw.username,
			error: 'server' as const
		});
	}
};
