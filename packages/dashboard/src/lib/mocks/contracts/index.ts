/**
 * Barrel re-export for the contracts layer.
 *
 * Everything mock code touches is exported from here, so the fixture
 * factories, scenarios, and handlers never have to know which file a
 * given schema lives in.
 *
 * This is the **self-contained** contracts package used by the mocks.
 * The M1-WS1 canonical contracts package (`packages/contracts/`) is
 * the long-term home; once it lands, the mocks can swap to
 * `$contracts` (path alias) and delete this folder. Until then, the
 * mocks work standalone — no cross-package dependency.
 */

export * from './primitives';
export * from './enums';

export {
	userSchema,
	sessionSchema,
	pamUserSchema,
	brandUser,
	brandPamUser,
	GROUP_MEMBERSHIPS,
	type User,
	type Session,
	type PamUser,
	type GroupMembership,
} from './entities/auth';

export {
	serviceSchema,
	serviceCheckSchema,
	serviceHealthSnapshotSchema,
	badgeRefSchema,
	brandService,
	type Service,
	type ServiceCheck,
	type ServiceHealthSnapshot,
	type BadgeRef,
} from './entities/service';

export {
	systemDataSchema,
	driveInfoSchema,
	mountInfoSchema,
	machineSensorSchema,
	processInfoSchema,
	networkInterfaceSchema,
	networkDataSchema,
	memoryInfoSchema,
	systemSensorsSchema,
	type SystemData,
	type DriveInfo,
	type MountInfo,
	type MachineSensor,
	type ProcessInfo,
	type NetworkInterface,
	type NetworkData,
	type MemoryInfo,
	type SystemSensors,
} from './entities/system';

export {
	dockerContainerSchema,
	dockerImageSchema,
	dockerVolumeSchema,
	dockerNetworkSchema,
	brandDockerContainer,
	brandDockerImage,
	brandDockerVolume,
	brandDockerNetwork,
	type DockerContainer,
	type DockerImage,
	type DockerVolume,
	type DockerNetwork,
} from './entities/docker';

export {
	incusInstanceConfigSchema,
	incusInstanceLiveSchema,
	incusInstanceDbSchema,
	incusInstanceDetailSchema,
	incusImageSchema,
	incusPreflightReportSchema,
	progressStepSchema,
	incusShellResultSchema,
	wizardDefaultsSchema,
	brandIncusInstanceDb,
	brandIncusInstanceDetail,
	brandIncusImage,
	type IncusInstanceConfig,
	type IncusInstanceLive,
	type IncusInstanceDb,
	type IncusInstanceDetail,
	type IncusImage,
	type IncusPreflightReport,
	type ProgressStep,
	type IncusShellResult,
	type WizardDefaults,
} from './entities/incus';

export {
	systemdUnitSchema,
	brandSystemdUnit,
	type SystemdUnit,
} from './entities/systemd';

export {
	alertRuleSchema,
	alertHistorySchema,
	alertEventSchema,
	brandAlertRule,
	brandAlertEvent,
	type AlertRule,
	type AlertHistory,
	type AlertEvent,
} from './entities/alerts';

export {
	auditEventSchema,
	dashboardCommandAuditSchema,
	brandAuditEvent,
	brandDashboardCommandAudit,
	type AuditEvent,
	type DashboardCommandAudit,
} from './entities/audit';

export {
	approvalRequestSchema,
	brandApprovalRequest,
	type ApprovalRequest,
} from './entities/approvals';

export {
	badgeSchema,
	projectSchema,
	agentFileSchema,
	agentSchema,
	mailReviewSchema,
	brandBadge,
	brandProject,
	brandAgent,
	brandMailReview,
	type Badge,
	type Project,
	type AgentFile,
	type Agent,
	type MailReview,
} from './entities/admin';

export {
	backupSnapshotSchema,
	schedulerJobSchema,
	notificationEntrySchema,
	envLineSchema,
	envBrowserResponseSchema,
	logEntrySchema,
	aiRequestSchema,
	aiResponseSchema,
	appPreferenceSchema,
	widgetConfigSchema,
	dashboardLayoutSchema,
	brandBackupSnapshot,
	brandSchedulerJob,
	brandNotification,
	brandLogEntry,
	brandAIRequest,
	brandAIResponse,
	brandAppPreference,
	brandWidgetConfig,
	brandDashboardLayout,
	type BackupSnapshot,
	type SchedulerJob,
	type NotificationEntry,
	type EnvLine,
	type EnvBrowserResponse,
	type LogEntry,
	type AIRequest,
	type AIResponse,
	type AppPreference,
	type WidgetConfig,
	type DashboardLayout,
} from './entities/misc';

export {
	terminalCommandSchema,
	terminalSessionSchema,
	terminalActionRequestSchema,
	terminalOutputFrameSchema,
	brandTerminalSession,
	type TerminalCommand,
	type TerminalSession,
	type TerminalActionRequest,
	type TerminalOutputFrame,
} from './entities/terminal';
