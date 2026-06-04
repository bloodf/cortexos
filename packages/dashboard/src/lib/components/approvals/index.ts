/**
 * Public surface for the Approvals feature components.
 *
 * Consumers should import from `$lib/components/approvals` rather
 * than reaching into individual files. This keeps the import graph
 * stable when components are split or renamed.
 */
export { default as ApprovalCard } from './ApprovalCard.svelte';
export { default as ApprovalList } from './ApprovalList.svelte';
export { default as ApprovalDetail } from './ApprovalDetail.svelte';
export { default as ApprovalActionBar } from './ApprovalActionBar.svelte';
export { default as ApprovalHistoryTimeline } from './ApprovalHistoryTimeline.svelte';
export { default as ApprovalTokenDisplay } from './ApprovalTokenDisplay.svelte';

export {
  adaptApproval,
  adaptApprovalList,
  filterByStatus,
  filterByAgeBucket,
  filterByQuery,
  bucketFor,
  statusToI18nKey,
  formatAge,
  APPROVAL_STATUSES,
  type Approval,
  type ApprovalStatus,
  type AgeBucket,
} from './adapter';
