/**
 * `destructive` scenario — destructive ops require an approval token.
 *
 * The M0-E threat model §4 (SR-020) defines the approval flow. The
 * matrix's "destructive" rows (DOCKER-REMOVE-CONFIRM-019, INCUS-DETAIL-DELETE,
 * SYSTEMD restart on prod, etc.) use this scenario: the first POST
 * without an `X-Cortex-Confirmation-Token` returns 403
 * APPROVAL_REQUIRED; the second POST with a valid-looking token
 * succeeds.
 *
 * For simplicity, the mock checks for the presence of the header;
 * `requireAdmin` + the 5s grace / 60s TTL are the M3 implementation
 * detail (HMAC + replay cache).
 */

import { json, type Scenario } from './types';

const hasApprovalToken = (headers: Headers) => {
	const h = headers.get('x-cortex-confirmation-token');
	return typeof h === 'string' && h.length > 0;
};

const destructive: Scenario = {
	name: 'destructive',
	description:
		'Destructive ops require X-Cortex-Confirmation-Token; without it, return 403 APPROVAL_REQUIRED.',
	matches: (ctx) => ctx.method === 'POST' || ctx.method === 'DELETE',
	respond: (ctx) => {
		if (hasApprovalToken(ctx.headers)) {
			return json({ success: true, approval: 'consumed' });
		}
		return json(
			{
				code: 'APPROVAL_REQUIRED',
				message: 'This action requires human approval (mock scenario: destructive)',
				action: `${ctx.method} ${ctx.pathTemplate}`,
				confirmationTokenHeader: 'X-Cortex-Confirmation-Token',
			},
			{ status: 403 },
		);
	},
};

export default destructive;
