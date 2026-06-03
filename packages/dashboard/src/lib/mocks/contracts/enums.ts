/**
 * Common enums and value objects used across entities.
 *
 * Kept narrow on purpose: the matrix is the source of truth for status
 * states, and any change here must come with a Zod schema test.
 */

export const SERVICE_STATUSES = ['online', 'offline', 'unknown', 'degraded'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_HEALTH_TYPES = ['http', 'tcp', 'docker', 'systemd', 'process'] as const;
export type ServiceHealthType = (typeof SERVICE_HEALTH_TYPES)[number];

export const SERVICE_KINDS = ['app', 'service', 'docker', 'process'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const SERVICE_CATEGORIES = [
	'AI',
	'Infrastructure',
	'Database',
	'Monitoring',
	'Home',
	'Media',
	'Utility',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const DOCKER_STATES = ['running', 'exited', 'paused', 'restarting', 'created', 'dead'] as const;
export type DockerState = (typeof DOCKER_STATES)[number];

export const INCUS_INSTANCE_STATUSES = [
	'draft',
	'validated',
	'provisioning',
	'active',
	'failed',
] as const;
export type IncusInstanceStatus = (typeof INCUS_INSTANCE_STATUSES)[number];

export const INCUS_INSTANCE_TYPES = ['container', 'vm'] as const;
export type IncusInstanceType = (typeof INCUS_INSTANCE_TYPES)[number];

export const INCUS_LIVE_STATES = ['Running', 'Stopped', 'Starting', 'Stopping', 'Frozen'] as const;
export type IncusLiveState = (typeof INCUS_LIVE_STATES)[number];

export const SYSTEMD_ACTIVE_STATES = ['active', 'inactive', 'failed', 'activating', 'deactivating'] as const;
export type SystemdActiveState = (typeof SYSTEMD_ACTIVE_STATES)[number];

export const SYSTEMD_LOAD_STATES = ['loaded', 'not-found', 'bad-setting', 'masked', 'error'] as const;
export type SystemdLoadState = (typeof SYSTEMD_LOAD_STATES)[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_CONDITIONS = ['offline', 'online', 'response_time'] as const;
export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

export const ALERT_STATUSES = ['fired', 'resolved', 'info'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_TOOL_CLASSES = ['safe', 'privileged', 'destructive'] as const;
export type AlertToolClass = (typeof ALERT_TOOL_CLASSES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'denied', 'expired'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const AUDIT_DECISIONS = ['allow', 'deny', 'prompt'] as const;
export type AuditDecision = (typeof AUDIT_DECISIONS)[number];

export const AUDIT_RESULTS = ['ok', 'err', 'timeout', 'denied'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const MAIL_DECISIONS = ['keep', 'spam', 'block_sender', 'allow_sender'] as const;
export type MailDecision = (typeof MAIL_DECISIONS)[number];

export const MAIL_VERDICTS = ['ham', 'spam', 'uncertain'] as const;
export type MailVerdict = (typeof MAIL_VERDICTS)[number];

export const BACKUP_STATUSES = ['healthy', 'stale', 'missing', 'corrupt'] as const;
export type BackupStatus = (typeof BACKUP_STATUSES)[number];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed', 'read'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const SENSOR_UNITS = ['celsius', 'rpm', 'volts'] as const;
export type SensorUnit = (typeof SENSOR_UNITS)[number];

export const ENV_LINE_TYPES = ['kv', 'comment', 'blank'] as const;
export type EnvLineType = (typeof ENV_LINE_TYPES)[number];

export const PROGRESS_STEP_STATUSES = ['ok', 'done', 'error', 'failed', 'pending', 'running'] as const;
export type ProgressStepStatus = (typeof PROGRESS_STEP_STATUSES)[number];

export const TERMINAL_ACTIONS = ['connect', 'exec', 'disconnect'] as const;
export type TerminalAction = (typeof TERMINAL_ACTIONS)[number];

export const AI_POLICY_CLASSES = ['safe', 'privileged', 'destructive', 'forbidden'] as const;
export type AIPolicyClass = (typeof AI_POLICY_CLASSES)[number];
