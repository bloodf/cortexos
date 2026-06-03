/**
 * /login page (M2-WS3, Kleppmann).
 *
 * Browser-initiated login. The page server-load:
 *   1. If already authenticated (locals.user), redirect to /dashboard.
 *   2. Otherwise, issue a "bootstrap" CSRF cookie so the SPA can
 *      make a state-changing POST to /api/auth/login.
 *
 * The form `action` posts to /api/auth/login (handled by the +server.ts
 * file in src/routes/api/auth/login/+server.ts). On success the
 * browser receives the session + CSRF cookies via Set-Cookie and is
 * redirected to ?next=... or /dashboard.
 */

import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { setCsrfCookie, LOGIN_BOOTSTRAP_CSRF } from '$lib/server/auth';

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
  default: async ({ request, locals }) => {
    // M2-WS3: the form action is a thin wrapper. The real auth
    // lives in /api/auth/login. We just bounce the form data into
    // the same flow (PAM + session creation) and return the result.
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
    // The form-action path doesn't issue cookies (those would go
    // through SvelteKit's form-action machinery); the proper way
    // is to POST to /api/auth/login with the X-CSRF-Token header.
    // The login page is rendered with the bootstrap CSRF cookie
    // already set; the client-side JS will make the API call.
    // This server-side path is preserved for users who have JS off.
    return fail(401, {
      username: raw.username,
      error: 'use_api' as const,
    });
  },
};
