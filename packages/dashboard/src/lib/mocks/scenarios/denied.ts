/**
 * `denied` scenario — auth/permission denied.
 *
 * Used by AUTH-005 (invalid credentials), DOCKER-DENY-021, INCUS-NEW-DENY-019,
 * SYSTEMD-DENY-011, and the SHELL-DENY-035 rows. Returns 401 on
 * `/api/auth` and 403 everywhere else (the standard
 * "you are logged in but not allowed" path).
 */

import { json, type Scenario } from './types';

const denied: Scenario = {
	name: 'denied',
	description:
		'401 on /api/auth, 403 PERMISSION_DENIED everywhere else. UI toast + button-disable paths.',
	matches: () => true,
	respond: (ctx) => {
		if (ctx.pathTemplate === '/api/auth') {
			return json(
				{ code: 'AUTH_ERROR', message: 'Invalid credentials' },
				{ status: 401 },
			);
		}
		return json(
			{
				code: 'PERMISSION_DENIED',
				message: 'You do not have permission to perform this action (mock scenario: denied)',
			},
			{ status: 403 },
		);
	},
};

export default denied;
