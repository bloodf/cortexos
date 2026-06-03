/**
 * `audit-fail` scenario — audit chain validation fails.
 *
 * Mapped to AUDIT-VERIFY-FAIL rows and the matrix's
 * `/api/audit/verify` (M0-B §1.8 noted this endpoint exists but is
 * not consumed by the current UI; M1 wires it in). The UI must
 * surface the broken-at-eventId so the operator can investigate.
 */

import { json, type Scenario } from './types';

const auditFail: Scenario = {
	name: 'audit-fail',
	description:
		'Audit chain integrity check fails. UI shows the broken-at event id and a banner.',
	matches: (ctx) =>
		ctx.pathTemplate === '/api/audit/verify' || ctx.pathTemplate === '/api/audit',
	respond: (ctx) => {
		if (ctx.pathTemplate === '/api/audit/verify') {
			return json(
				{
					code: 'AUDIT_CHAIN_INVALID',
					message: 'Audit chain integrity check failed (mock scenario: audit-fail)',
					brokenAtEventId: 'aud_0042',
				},
				{ status: 500 },
			);
		}
		// /api/audit: still return rows, but include a `chainOk: false` flag
		return json({ rows: [], total: 0, chainOk: false });
	},
};

export default auditFail;
