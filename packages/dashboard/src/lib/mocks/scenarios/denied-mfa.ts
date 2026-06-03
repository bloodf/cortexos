/**
 * `denied-mfa` scenario — MFA required.
 *
 * Generic MFA gate. The matrix flags MFA challenges on the
 * `account` page (admin password change) and on `/api/approvals`
 * (admin-only operations). M3 will plug TOTP / WebAuthn in;
 * for now the UI must render the challenge UI.
 */

import { json, type Scenario } from './types';

const deniedMfa: Scenario = {
	name: 'denied-mfa',
	description: 'MFA required (TOTP / WebAuthn). UI must show the challenge prompt.',
	matches: (ctx) => {
		return (
			ctx.pathTemplate === '/api/auth/password' ||
			(ctx.pathTemplate === '/api/approvals' && ctx.method === 'POST')
		);
	},
	respond: () =>
		json(
			{
				code: 'MFA_REQUIRED',
				message: 'MFA challenge required (mock scenario: denied-mfa)',
				challengeId: 'mfa_chal_mock',
				method: 'totp',
			},
			{ status: 401 },
		),
};

export default deniedMfa;
