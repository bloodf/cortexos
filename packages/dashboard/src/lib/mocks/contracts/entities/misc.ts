/**
 * Backups + scheduler + notifications + env-browser + logs + AI + dashboard prefs.
 *
 * Source:
 *   - `/api/backups` — NOT IMPLEMENTED in M0; the matrix mocks the
 *     empty state (BACKUP-001) and the page hits a 404 today.
 *   - `/api/scheduler` — parsed from `systemctl list-timers --all`.
 *   - `/api/notifications` — `api.notifications()` returns `[]` (no backend).
 *   - `/api/env-browser` — `{ path, lines: EnvLine[] }` (kv masked by default).
 *   - `/api/logs/stream` — SSE (deferred to M3; M1 mocks an empty stream).
 *   - `/api/ai/chat` — SSE stream (M0-B §1.11).
 *   - `/api/layout` (UI layout prefs) — localStorage on the client.
 */

import { z } from 'zod';
import {
	asSchedulerJobId,
	asNotificationId,
	asEnvVarName,
	asLogEntryId,
	asAIRequestId,
	asAIResponseId,
	asAppPreferenceKey,
	asDashboardLayoutId,
	asWidgetConfigId,
	asBackupSnapshotId,
} from '../primitives';
import { BACKUP_STATUSES, ENV_LINE_TYPES, NOTIFICATION_STATUSES } from '../enums';

export const backupSnapshotSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	createdAt: z.string().datetime(),
	size: z.number().nonnegative(),
	status: z.enum(BACKUP_STATUSES),
	path: z.string().min(1),
	checksum: z.string().nullable(),
	encrypted: z.boolean(),
});
export type BackupSnapshot = z.infer<typeof backupSnapshotSchema> & {
	id: ReturnType<typeof asBackupSnapshotId>;
};

export const schedulerJobSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	schedule: z.string().min(1),
	nextRun: z.string().datetime(),
	lastRun: z.string().datetime().nullable(),
	enabled: z.boolean(),
	unit: z.string().min(1),
	description: z.string().default(''),
});
export type SchedulerJob = z.infer<typeof schedulerJobSchema> & {
	id: ReturnType<typeof asSchedulerJobId>;
};

export const notificationEntrySchema = z.object({
	id: z.string().min(1),
	channel: z.string().min(1),
	message: z.string().min(1),
	sentAt: z.string().datetime(),
	status: z.enum(NOTIFICATION_STATUSES),
	read: z.boolean().default(false),
	severity: z.enum(['info', 'warning', 'error', 'critical']).default('info'),
});
export type NotificationEntry = z.infer<typeof notificationEntrySchema> & {
	id: ReturnType<typeof asNotificationId>;
};

export const envLineSchema = z.object({
	line: z.number().int().positive(),
	raw: z.string(),
	type: z.enum(ENV_LINE_TYPES),
	key: z.string().optional(),
	value: z.string().optional(),
	exported: z.boolean().optional(),
	masked: z.boolean().optional(),
});
export type EnvLine = z.infer<typeof envLineSchema> & { key?: ReturnType<typeof asEnvVarName> };

export const envBrowserResponseSchema = z.object({
	path: z.string().min(1),
	lines: z.array(envLineSchema),
});
export type EnvBrowserResponse = z.infer<typeof envBrowserResponseSchema>;

export const logEntrySchema = z.object({
	id: z.string().min(1),
	timestamp: z.string().datetime(),
	level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
	source: z.string().min(1),
	message: z.string().min(1),
	fields: z.record(z.string(), z.unknown()).default({}),
});
export type LogEntry = z.infer<typeof logEntrySchema> & { id: ReturnType<typeof asLogEntryId> };

export const aiRequestSchema = z.object({
	id: z.string().min(1),
	model: z.string().min(1),
	messages: z.array(
		z.object({
			role: z.enum(['system', 'user', 'assistant', 'tool']),
			content: z.string(),
		}),
	),
	stream: z.boolean().default(false),
	policyClass: z.enum(['safe', 'privileged', 'destructive', 'forbidden']).default('safe'),
	createdAt: z.string().datetime(),
});
export type AIRequest = z.infer<typeof aiRequestSchema> & { id: ReturnType<typeof asAIRequestId> };

export const aiResponseSchema = z.object({
	id: z.string().min(1),
	requestId: z.string().min(1),
	model: z.string().min(1),
	content: z.string(),
	finishReason: z.enum(['stop', 'length', 'tool_calls', 'error']).default('stop'),
	usage: z
		.object({
			promptTokens: z.number().int().nonnegative(),
			completionTokens: z.number().int().nonnegative(),
			totalTokens: z.number().int().nonnegative(),
		})
		.optional(),
	createdAt: z.string().datetime(),
});
export type AIResponse = z.infer<typeof aiResponseSchema> & {
	id: ReturnType<typeof asAIResponseId>;
};

export const appPreferenceSchema = z.object({
	key: z.string().min(1),
	value: z.unknown(),
	updatedAt: z.string().datetime(),
});
export type AppPreference = z.infer<typeof appPreferenceSchema> & {
	key: ReturnType<typeof asAppPreferenceKey>;
};

export const widgetConfigSchema = z.object({
	id: z.string().min(1),
	kind: z.string().min(1),
	x: z.number().int().nonnegative(),
	y: z.number().int().nonnegative(),
	w: z.number().int().positive(),
	h: z.number().int().positive(),
	minW: z.number().int().positive().optional(),
	minH: z.number().int().positive().optional(),
	settings: z.record(z.string(), z.unknown()).default({}),
});
export type WidgetConfig = z.infer<typeof widgetConfigSchema> & {
	id: ReturnType<typeof asWidgetConfigId>;
};

export const dashboardLayoutSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	widgets: z.array(widgetConfigSchema),
	isDefault: z.boolean().default(false),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema> & {
	id: ReturnType<typeof asDashboardLayoutId>;
};

export const brandBackupSnapshot = (
	b: z.infer<typeof backupSnapshotSchema>,
): BackupSnapshot => ({ ...b, id: asBackupSnapshotId(b.id) });
export const brandSchedulerJob = (j: z.infer<typeof schedulerJobSchema>): SchedulerJob => ({
	...j,
	id: asSchedulerJobId(j.id),
});
export const brandNotification = (
	n: z.infer<typeof notificationEntrySchema>,
): NotificationEntry => ({ ...n, id: asNotificationId(n.id) });
export const brandLogEntry = (e: z.infer<typeof logEntrySchema>): LogEntry => ({
	...e,
	id: asLogEntryId(e.id),
});
export const brandAIRequest = (r: z.infer<typeof aiRequestSchema>): AIRequest => ({
	...r,
	id: asAIRequestId(r.id),
});
export const brandAIResponse = (r: z.infer<typeof aiResponseSchema>): AIResponse => ({
	...r,
	id: asAIResponseId(r.id),
});
export const brandAppPreference = (p: z.infer<typeof appPreferenceSchema>): AppPreference => ({
	...p,
	key: asAppPreferenceKey(p.key),
});
export const brandWidgetConfig = (w: z.infer<typeof widgetConfigSchema>): WidgetConfig => ({
	...w,
	id: asWidgetConfigId(w.id),
});
export const brandDashboardLayout = (l: z.infer<typeof dashboardLayoutSchema>): DashboardLayout => ({
	...l,
	id: asDashboardLayoutId(l.id),
});
