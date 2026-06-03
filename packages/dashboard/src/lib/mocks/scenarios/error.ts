/**
 * `error` scenario — every endpoint returns 500 Internal Error.
 *
 * The matrix's "server error" rows (AUTH-006, DOCKER-START-ERR,
 * INCUS-DETAIL-ERR, etc.) wire this scenario. The UI's error toast
 * path is exercised.
 */

import { json, type Scenario } from './types';

const error: Scenario = {
	name: 'error',
	description: 'Every endpoint returns 500 INTERNAL_ERROR. UI error-toast paths.',
	matches: () => true,
	respond: () =>
		json(
			{
				code: 'INTERNAL_ERROR',
				message: 'Simulated server error (mock scenario: error)',
			},
			{ status: 500 },
		),
};

export default error;
