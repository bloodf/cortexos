/**
 * `approval` scenario — the approval-request body shape.
 *
 * Used by the matrix's /api/approvals GET rows (APPROVAL-001..)
 * and the dashboard's `approvals` page. The shape mirrors
 * `ApprovalRequest` from the contracts layer.
 */

import { makeApprovalRequest } from '../fixtures';
import { json, type Scenario } from './types';

const approval: Scenario = {
	name: 'approval',
	description: 'Returns ApprovalRequest rows with status=pending for the /approvals page.',
	matches: (ctx) => ctx.pathTemplate === '/api/approvals',
	respond: (ctx) => {
		if (ctx.method === 'GET') {
			return json({
				approvals: Array.from({ length: 3 }, () =>
					makeApprovalRequest({ status: 'pending' }),
				),
			});
		}
		return json({ success: true, requestId: 'apr_mock' });
	},
};

export default approval;
