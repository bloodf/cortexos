/**
 * Alert entities: AlertRule, AlertHistory, AlertEvent.
 *
 * Source: `/api/alerts` (rules) and `/api/alerts?history=1` (history).
 * The IncidentToaster polls every 4s for `history` (M0-B §4.2).
 */

import { z } from 'zod';
import { asAlertRuleId, asAlertEventId } from '../primitives';
import { ALERT_CONDITIONS, ALERT_SEVERITIES, ALERT_STATUSES } from '../enums';

export const alertRuleSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	serviceId: z.string().nullable(),
	condition: z.enum(ALERT_CONDITIONS),
	thresholdMs: z.number().int().nonnegative().nullable(),
	enabled: z.boolean(),
	severity: z.enum(ALERT_SEVERITIES),
	channels: z.array(z.string()).default([]),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});
export type AlertRule = z.infer<typeof alertRuleSchema> & { id: ReturnType<typeof asAlertRuleId> };

export const alertHistorySchema = z.object({
	id: z.string().min(1),
	ruleName: z.string().min(1),
	serviceName: z.string(),
	status: z.enum(ALERT_STATUSES),
	message: z.string(),
	severity: z.enum(ALERT_SEVERITIES),
	timestamp: z.string().datetime(),
	resolvedAt: z.string().datetime().nullable(),
});
export type AlertHistory = z.infer<typeof alertHistorySchema>;

export const alertEventSchema = z.object({
	id: z.string().min(1),
	ruleId: z.string().min(1),
	severity: z.enum(ALERT_SEVERITIES),
	status: z.enum(ALERT_STATUSES),
	message: z.string(),
	firedAt: z.string().datetime(),
	resolvedAt: z.string().datetime().nullable(),
});
export type AlertEvent = z.infer<typeof alertEventSchema> & { id: ReturnType<typeof asAlertEventId> };

export const brandAlertRule = (r: z.infer<typeof alertRuleSchema>): AlertRule => ({
	...r,
	id: asAlertRuleId(r.id),
});
export const brandAlertEvent = (e: z.infer<typeof alertEventSchema>): AlertEvent => ({
	...e,
	id: asAlertEventId(e.id),
});
