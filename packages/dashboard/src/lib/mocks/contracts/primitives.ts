/**
 * Branded primitive types.
 *
 * These prevent ID confusion at the type level: a function that takes
 * `ServiceId` cannot accept an `AlertId`, even though both are strings
 * at runtime. The brand is purely compile-time; the underlying value
 * is still a `string`.
 *
 * Use the `asUserId(...)` etc. helpers to construct values safely.
 *
 * Layer 2 of the prod-leak guard: this file is imported only by mock
 * code; production code paths must use the unbranded string types
 * from `$contracts` (the M1-WS1 canonical contracts package) or
 * import these only via the `__mocks__/contracts` re-exports.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type ServiceId = Brand<string, 'ServiceId'>;
export type ServiceSlug = Brand<string, 'ServiceSlug'>;
export type ServiceHealthSnapshotId = Brand<string, 'ServiceHealthSnapshotId'>;
export type AlertRuleId = Brand<string, 'AlertRuleId'>;
export type AlertEventId = Brand<string, 'AlertEventId'>;
export type AuditEventId = Brand<string, 'AuditEventId'>;
export type DashboardCommandAuditId = Brand<string, 'DashboardCommandAuditId'>;
export type ContainerId = Brand<string, 'ContainerId'>;
export type ImageId = Brand<string, 'ImageId'>;
export type VolumeName = Brand<string, 'VolumeName'>;
export type NetworkId = Brand<string, 'NetworkId'>;
export type IncusInstanceId = Brand<string, 'IncusInstanceId'>;
export type IncusImageFingerprint = Brand<string, 'IncusImageFingerprint'>;
export type SystemdUnitName = Brand<string, 'SystemdUnitName'>;
export type TerminalSessionId = Brand<string, 'TerminalSessionId'>;
export type EnvVarName = Brand<string, 'EnvVarName'>;
export type LogEntryId = Brand<string, 'LogEntryId'>;
export type ProjectSlug = Brand<string, 'ProjectSlug'>;
export type NotificationId = Brand<string, 'NotificationId'>;
export type BackupSnapshotId = Brand<string, 'BackupSnapshotId'>;
export type SchedulerJobId = Brand<string, 'SchedulerJobId'>;
export type BadgeSlug = Brand<string, 'BadgeSlug'>;
export type AgentSlug = Brand<string, 'AgentSlug'>;
export type ApprovalRequestId = Brand<string, 'ApprovalRequestId'>;
export type MailReviewId = Brand<string, 'MailReviewId'>;
export type AppPreferenceKey = Brand<string, 'AppPreferenceKey'>;
export type DashboardLayoutId = Brand<string, 'DashboardLayoutId'>;
export type WidgetConfigId = Brand<string, 'WidgetConfigId'>;
export type AIRequestId = Brand<string, 'AIRequestId'>;
export type AIResponseId = Brand<string, 'AIResponseId'>;

/** Construct branded IDs from raw strings. Use only at trust boundaries. */
export const asUserId = (s: string): UserId => s as UserId;
export const asServiceId = (s: string): ServiceId => s as ServiceId;
export const asServiceSlug = (s: string): ServiceSlug => s as ServiceSlug;
export const asAlertRuleId = (s: string): AlertRuleId => s as AlertRuleId;
export const asAlertEventId = (s: string): AlertEventId => s as AlertEventId;
export const asAuditEventId = (s: string): AuditEventId => s as AuditEventId;
export const asContainerId = (s: string): ContainerId => s as ContainerId;
export const asImageId = (s: string): ImageId => s as ImageId;
export const asIncusInstanceId = (s: string): IncusInstanceId => s as IncusInstanceId;
export const asSystemdUnitName = (s: string): SystemdUnitName => s as SystemdUnitName;
export const asTerminalSessionId = (s: string): TerminalSessionId => s as TerminalSessionId;
export const asProjectSlug = (s: string): ProjectSlug => s as ProjectSlug;
export const asSchedulerJobId = (s: string): SchedulerJobId => s as SchedulerJobId;
export const asBadgeSlug = (s: string): BadgeSlug => s as BadgeSlug;
export const asAgentSlug = (s: string): AgentSlug => s as AgentSlug;
export const asApprovalRequestId = (s: string): ApprovalRequestId => s as ApprovalRequestId;
export const asMailReviewId = (s: string): MailReviewId => s as MailReviewId;
export const asBackupSnapshotId = (s: string): BackupSnapshotId => s as BackupSnapshotId;
export const asNotificationId = (s: string): NotificationId => s as NotificationId;
export const asLogEntryId = (s: string): LogEntryId => s as LogEntryId;
export const asEnvVarName = (s: string): EnvVarName => s as EnvVarName;
export const asAIRequestId = (s: string): AIRequestId => s as AIRequestId;
export const asAIResponseId = (s: string): AIResponseId => s as AIResponseId;
export const asDashboardLayoutId = (s: string): DashboardLayoutId => s as DashboardLayoutId;
export const asWidgetConfigId = (s: string): WidgetConfigId => s as WidgetConfigId;
export const asVolumeName = (s: string): VolumeName => s as VolumeName;
export const asNetworkId = (s: string): NetworkId => s as NetworkId;
export const asIncusImageFingerprint = (s: string): IncusImageFingerprint =>
	s as IncusImageFingerprint;
export const asAppPreferenceKey = (s: string): AppPreferenceKey => s as AppPreferenceKey;
export const asServiceHealthSnapshotId = (s: string): ServiceHealthSnapshotId =>
	s as ServiceHealthSnapshotId;
export const asDashboardCommandAuditId = (s: string): DashboardCommandAuditId =>
	s as DashboardCommandAuditId;
