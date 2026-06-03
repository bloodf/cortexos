/**
 * `denied-rht-2fa` scenario — real-host test (RHT) requires 2FA.
 *
 * The M0-C matrix flags a handful of rows with `RHT` (terminal
 * real-host test, privileged network operations, etc.). The UI must
 * show the "complete 2FA challenge" prompt. This scenario returns
 * 401 RHT_2FA_REQUIRED with a `challengeId` the UI can echo back
 * via `/api/auth/2fa/verify`.
 */

import { json, type Scenario } from './types';

const deniedRht2fa: Scenario = {
	name: 'denied-rht-2fa',
	description: 'Real-host test endpoints require 2FA challenge completion before responding.',
	matches: (ctx) => {
		// Heuristic: terminal + privileged shell endpoints require 2FA
		// outside the unit/E2E matrix. The M1-WS4 backend will encode
		// this in the route's auth gate; here we match by path.
		return (
			ctx.pathTemplate === '/api/terminal' ||
			ctx.pathTemplate === '/api/incus/[name]/shell' ||
			ctx.pathTemplate === '/api/root-helper/commands'
		);
	},
	respond: () =>
		json(
			{
				code: 'RHT_2FA_REQUIRED',
				message: 'Real-host test surface; complete 2FA challenge to continue.',
				challengeId: 'rht_chal_mock',
			},
			{ status: 401 },
		),
};

export default deniedRht2fa;
