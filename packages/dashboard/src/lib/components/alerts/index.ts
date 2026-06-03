/**
 * Public surface for the Alerts feature components.
 *
 * Consumers should import from `$lib/components/alerts` rather than
 * reaching into individual files. This keeps the import graph
 * stable when components are split or renamed.
 *
 * The adapter is also re-exported here because route loaders
 * transform Drizzle rows into the contracts types via the adapter
 * before passing them to the components.
 */
export { default as AlertSeverityBadge } from './AlertSeverityBadge.svelte';
export { default as AlertHistoryTimeline } from './AlertHistoryTimeline.svelte';
export { default as OperationalAlertCard } from './OperationalAlertCard.svelte';
export { default as OperationalAlertList } from './OperationalAlertList.svelte';
export { default as OperationalAlertDetail } from './OperationalAlertDetail.svelte';
export { default as RuleCard } from './RuleCard.svelte';
export { default as RuleDetail } from './RuleDetail.svelte';
export { default as RuleForm } from './RuleForm.svelte';
export { default as RuleList } from './RuleList.svelte';

export {
	adaptAlertRule,
	adaptAlertRuleList,
	adaptAlertEvent,
	adaptAlertEventList,
	adaptOperationalAlert,
	adaptOperationalAlertList,
	toContractSeverity,
	CHANNELS,
} from './adapter';
export type {
	DbAlertRule,
	DbAlertHistoryRow,
	DbOperationalAlert,
	AlertSeverityLit,
	AlertConditionLit,
	AlertChannelLit,
	AlertEventStatusLit,
} from './adapter';
