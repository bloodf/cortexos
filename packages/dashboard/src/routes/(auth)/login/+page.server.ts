import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import {
  setCsrfCookie,
  setSessionCookie,
  generateCsrfToken,
  getPamAuthenticator,
  getSessionStore,
  LOGIN_BOOTSTRAP_CSRF,
} from '$lib/server/auth';

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const load: PageServerLoad = ({ locals, cookies }) => {
  if (locals.user) {
    throw redirect(303, '/dashboard');
  }
  // Issue a bootstrap CSRF cookie so the form submit can satisfy
  // the double-submit check on /api/auth/login. The cookie is the
  // special "login-bootstrap" placeholder; a real CSRF token will
  // be issued on a successful login.
  setCsrfCookie(cookies as never, LOGIN_BOOTSTRAP_CSRF);
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
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

    const { username, password } = parsed.data;
    const pam = getPamAuthenticator();
    const auth = await pam.authenticate(username, password);

    if (!auth.ok) {
      return fail(401, {
        username,
        error: 'invalid' as const,
      });
    }

    const groups = await pam.getGroups(auth.username);
    const isAdmin = groups.includes('cortexos-admin');
    const csrfToken = generateCsrfToken();
    const ip = getClientAddress();
    const ua = request.headers.get('user-agent');

    const created = await getSessionStore().createSession({
      username: auth.username,
      csrfToken,
      ip,
      userAgent: ua,
      isAdmin,
    });

    setSessionCookie(cookies as never, created.token);
    setCsrfCookie(cookies as never, csrfToken);

    throw redirect(303, '/dashboard');
  },
};
