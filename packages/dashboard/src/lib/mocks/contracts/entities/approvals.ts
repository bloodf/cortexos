/**
 * Approval-flow entity: ApprovalRequest.
 *
 * Source: `/api/approvals` (M0-A flagged this as no-auth-gate; the
 * M1-WS4 task requires `requireAdmin` on the POST). The M0-E threat
 * model defines the approval token shape (HMAC-SHA256, action-hash
 * bound, single-use, 60s TTL, 5s grace) — but the *request* is just
 * the row in the approval queue.
 */

import { z } from 'zod';
import { asApprovalRequestId } from '../primitives';
import { ALERT_TOOL_CLASSES, APPROVAL_STATUSES } from '../enums';

export const approvalRequestSchema = z.object({
	id: z.string().min(1),
	actor: z.string().min(1),
	tool: z.string().min(1),
	toolClass: z.enum(ALERT_TOOL_CLASSES),
	summary: z.string().min(1),
	argsPreview: z.record(z.string(), z.unknown()),
	requestedAt: z.string().datetime(),
	status: z.enum(APPROVAL_STATUSES),
	reason: z.string().nullable(),
	decider: z.string().nullable(),
	decidedAt: z.string().datetime().nullable(),
	tokenHash: z.string().nullable(),
});
export type ApprovalRequest = z.infer<typeof approvalRequestSchema> & {
	id: ReturnType<typeof asApprovalRequestId>;
};

export const brandApprovalRequest = (
	r: z.infer<typeof approvalRequestSchema>,
): ApprovalRequest => ({ ...r, id: asApprovalRequestId(r.id) });
