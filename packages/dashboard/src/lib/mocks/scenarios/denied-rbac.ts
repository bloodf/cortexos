/**
 * `denied-rbac` scenario — standard user hitting admin endpoints.
 *
 * Mapped to the matrix's RBAC pair rows (DOCKER-DENY-021,
 * INCUS-DETAIL-DENY-030, SYSTEMD-DENY-011, AUTH-014). Returns
 * 403 PERMISSION_DENIED with a `requiredRole: 'admin'` hint so
 * the UI's `useAuth().isAdmin` guard can render the proper
 * "Admin only" copy.
 */

import { json, type Scenario } from './types';

const deniedRbac: Scenario = {
	name: 'denied-rbac',
	description:
		'Standard user hitting admin endpoints → 403 PERMISSION_DENIED with requiredRole=admin.',
	matches: (ctx) => {
		// Match any admin/* route. M1-WS4 will translate this to the
		// real admin path namespace; for now we match by URL prefix.
		return (
			ctx.pathTemplate.startsWith('/api/admin') ||
			ctx.pathTemplate === '/api/docker/actions' ||
			ctx.pathTemplate === '/api/systemd/actions' ||
			ctx.pathTemplate === '/api/incus/actions'
		);
	},
	respond: () =>
		json(
			{
				code: 'PERMISSION_DENIED',
				message: 'Admin role required (mock scenario: denied-rbac)',
				requiredRole: 'admin',
			},
			{ status: 403 },
		),
};

export default deniedRbac;
