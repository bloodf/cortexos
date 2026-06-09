/**
 * POST /api/env-browser/unlock — open a secret-reveal window.
 *
 * THREAT_MODEL §1.2 surface 8: revealing a plaintext secret in the
 * env-browser requires the operator to re-prove their identity with
 * their PAM password (step-up auth). A successful verification opens a
 * reveal window (REVEAL_TTL, 10 min) bound to THIS session; while open,
 * GET /api/env-browser returns raw values. The password is verified
 * against the host PAM stack for the *currently authenticated* user —
 * it is never stored, logged, or echoed.
 *
 * admin-only · CSRF-protected (enforced by defineRoute for POST) ·
 * rate-limited to blunt online password guessing.
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { authError } from '$lib/server/errors/types';
import { getPamAuthenticator } from '$lib/server/auth/pam';
import { grantReveal, REVEAL_TTL_SEC } from '$lib/server/env-reveal';

const UnlockInput = z.object({
	password: z.string().min(1).max(1024),
});

export const POST = defineRoute({
	methods: ['POST'],
	input: UnlockInput,
	auth: 'admin',
	surface: 'env-browser',
	action: 'env-browser.unlock',
	// NB: never put the password (or any derivative) in the audit target.
	target: () => null,
	rateLimit: { limit: 5, windowSec: 60, bucket: 'user' },
	handler: async ({ input, user, event }) => {
		const sessionId = event.locals.session?.id ?? null;
		if (!sessionId) {
			throw authError('No active session');
		}

		const result = await getPamAuthenticator().authenticate(user.username, input.password);
		if (!result.ok) {
			// Coarse failure only — do not distinguish bad-password from
			// other PAM reasons to the client (T-101).
			throw authError('Password verification failed');
		}

		const expiresAt = grantReveal(sessionId);
		return {
			ok: true as const,
			expiresAt,
			ttlSec: REVEAL_TTL_SEC,
		};
	},
});
