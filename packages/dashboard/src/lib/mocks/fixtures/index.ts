/**
 * Barrel for all fixture factories. Import only what you need.
 *
 * Deterministic: faker is seeded with `42` in `./seed.ts`. The same
 * import order produces the same data every run.
 *
 * For tests that need isolated randomness, use `withFakerSeed(...)`
 * from `./seed.ts`.
 */

// Auth + service
export {
	makeUser,
	makeAdminUser,
	makeStandardUser,
	makeSession,
	makePamUser,
	makeService,
	makeServiceCheck,
	makeServiceHealthSnapshot,
	makeAlertRule,
	makeAlertHistory,
	makeAlertEvent,
	makeMany,
	makeServiceList,
	makeServiceCheckList,
	makeAlertRuleList,
	makeAlertHistoryList,
} from './auth-service';

// Everything else
export {
	makeDriveInfo,
	makeMountInfo,
	makeMachineSensor,
	makeProcessInfo,
	makeNetworkInterface,
	makeNetworkData,
	makeSystemData,
	makeDockerContainer,
	makeDockerImage,
	makeDockerVolume,
	makeDockerNetwork,
	makeIncusInstanceDb,
	makeIncusInstanceDetail,
	makeIncusImage,
	makeWizardDefaults,
	makeIncusPreflightReport,
	makeProgressStep,
	makeIncusShellResult,
	makeSystemdUnit,
	makeTerminalSession,
	makeTerminalCommand,
	makeAuditEvent,
	makeDashboardCommandAudit,
	makeApprovalRequest,
	makeBadge,
	makeProject,
	makeAgent,
	makeMailReview,
	makeBackupSnapshot,
	makeSchedulerJob,
	makeNotification,
	makeLogEntry,
	makeAIRequest,
	makeAIResponse,
	makeAppPreference,
	makeWidgetConfig,
	makeDashboardLayout,
	makeEnvLine,
	makeEnvBrowserResponse,
	makeContainerList,
	makeImageList,
	makeVolumeList,
	makeIncusInstanceList,
	makeSystemdUnitList,
	makeAuditEventList,
	makeApprovalRequestList,
	makeBackupSnapshotList,
	makeSchedulerJobList,
	makePamUserList,
	makeBadgeList,
	makeProjectList,
	makeMailReviewList,
} from './entities';

export { seedFaker, withFakerSeed, makeFaker, FROZEN_NOW, DEFAULT_TEST_SEED } from './seed';
