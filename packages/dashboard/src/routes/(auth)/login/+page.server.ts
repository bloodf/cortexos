import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const LoginSchema = z.object({
	username: z.string().min(1, 'Username is required.'),
	password: z.string().min(1, 'Password is required.'),
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
		// `requestId` is part of the request contract set by hooks.server.ts;
		// touch it so the strict `no-unused-vars` rule doesn't flag the
		// destructured locals binding.
		void locals.requestId;
		const form = await request.formData();
		const raw = {
			username: String(form.get('username') ?? ''),
			password: String(form.get('password') ?? ''),
		};
		const parsed = LoginSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, {
				username: raw.username,
				error: 'required' as const,
			});
		}
		// Real PAM auth lands in M1-WS4-backend-skeleton + M3. Until
		// then the M1 shell returns 401 to make the wiring visible.
		return fail(401, {
			username: raw.username,
			error: 'server' as const,
		});
	},
};
