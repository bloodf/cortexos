/**
 * Audit-log entities: AuditEvent, DashboardCommandAudit.
 *
 * Source: `/api/audit` (admin) and `/api/dashboard_command_audit`.
 * The M0-A audit + M0-E threat model define the hash-chain shape:
 *   prevHash = SHA256(lastAuditEvent.id + lastAuditEvent.createdAt + lastAuditEvent.payload)
 *   currHash = SHA256(prevHash + thisEvent.payload)
 *
 * `DashboardCommandAudit` adds a two-phase lifecycle (INSERT created
 * → UPDATE finished) per the M0-A v2 gate decision.
 */

import { z } from 'zod';
import { asAuditEventId, asDashboardCommandAuditId } from '../primitives';
import { ALERT_TOOL_CLASSES, AUDIT_DECISIONS, AUDIT_RESULTS } from '../enums';

export const auditEventSchema = z.object({
	id: z.string().min(1),
	actorId: z.string().nullable(),
	actorUsername: z.string().nullable(),
	action: z.string().min(1),
	target: z.string().nullable(),
	tool: z.string().nullable(),
	toolClass: z.enum(ALERT_TOOL_CLASSES),
	decision: z.enum(AUDIT_DECISIONS),
	decisionReason: z.string().nullable(),
	result: z.enum(AUDIT_RESULTS),
	payload: z.record(z.string(), z.unknown()),
	ip: z.string(),
	ua: z.string(),
	createdAt: z.string().datetime(),
	prevHash: z.string().nullable(),
	currHash: z.string().min(1),
});
export type AuditEvent = z.infer<typeof auditEventSchema> & { id: ReturnType<typeof asAuditEventId> };

export const dashboardCommandAuditSchema = z.object({
	id: z.string().min(1),
	requestId: z.string().min(1),
	requestedBy: z.string().min(1),
	command: z.string().min(1),
	status: z.enum(['pending', 'running', 'finished', 'failed', 'timeout']),
	output: z.string().nullable(),
	error: z.string().nullable(),
	startedAt: z.string().datetime().nullable(),
	finishedAt: z.string().datetime().nullable(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	prevHash: z.string().nullable(),
	currHash: z.string().min(1),
});
export type DashboardCommandAudit = z.infer<typeof dashboardCommandAuditSchema> & {
	id: ReturnType<typeof asDashboardCommandAuditId>;
};

export const brandAuditEvent = (e: z.infer<typeof auditEventSchema>): AuditEvent => ({
	...e,
	id: asAuditEventId(e.id),
});
export const brandDashboardCommandAudit = (
	d: z.infer<typeof dashboardCommandAuditSchema>,
): DashboardCommandAudit => ({ ...d, id: asDashboardCommandAuditId(d.id) });
