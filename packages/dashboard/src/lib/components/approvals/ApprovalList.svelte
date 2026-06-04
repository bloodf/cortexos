<!--
  ApprovalList — table view of approvals, built on the design-system
  DataTable.

  The DataTable primitive owns sort/filter/pagination state. This
  component wires the column definitions (which fields are visible
  and how cells render) and provides a small "open" affordance per
  row for the detail-page navigation.

  Row-click navigation is handled by the page layer via a wrapping
  click handler — this component intentionally does not own
  navigation so it can be reused inside non-link surfaces (e.g. an
  admin table that opens a side panel).

  i18n: pass the locale `messages` map; column headers and the
  region aria-label route through `t(messages, 'approvals.*')`.
-->
<script lang="ts" generics="T extends Approval">
	import type { Snippet } from 'svelte';
	import type { Column, SortDir } from '$lib/components/ui/data-table/DataTable.types';
	import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { t, type Messages } from '$lib/i18n';
	import { formatAge, statusToI18nKey, type Approval } from './adapter';

	type Props = {
		/** The rows to display. The component treats them as read-only. */
		approvals: readonly T[];
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Page size — defaults to 25. */
		pageSize?: number;
		/** Initial sort key/direction. */
		initialSort?: { key: string; dir: SortDir };
		/** Optional empty-state snippet (overrides the default). */
		empty?: Snippet;
		/** Optional className passthrough. */
		class?: string;
	};

	let { approvals, messages, pageSize = 25, initialSort, empty, class: className }: Props =
		$props();

	/** Map a status to a Badge variant — single source of truth. */
	function variantFor(
		status: Approval['status'],
	): 'success' | 'destructive' | 'warning' | 'info' | 'secondary' {
		switch (status) {
			case 'approved':
				return 'success';
			case 'denied':
				return 'destructive';
			case 'expired':
			case 'timeout':
				return 'warning';
			case 'pending':
				return 'info';
			case 'unknown':
				return 'secondary';
		}
	}

	// Column headers resolve through t() so they follow the active
	// locale. The DataTable primitive sorts + paginates the data
	// itself; we only define what's *visible* in each column.
	const columns: Column<Record<string, unknown>>[] = $derived([
		{ key: 'signalName', header: t(messages, 'approvals.list.columns.signal'), sortable: true },
		{ key: 'runId', header: t(messages, 'approvals.list.columns.run'), sortable: true },
		{ key: 'role', header: t(messages, 'approvals.list.columns.role'), sortable: true },
		{ key: 'reason', header: t(messages, 'approvals.list.columns.reason'), sortable: false },
		{
			key: 'ageSec',
			header: t(messages, 'approvals.list.columns.age'),
			sortable: true,
			cell: ageCell,
		},
		{
			key: 'status',
			header: t(messages, 'approvals.detail.fields.decision'),
			sortable: true,
			cell: statusCell,
		},
	]);

	// Cast at the edge: every column key is a real property of T
	// (Approval) by construction, and the cell snippets handle the
	// typed property access.
	const rows = $derived(approvals as unknown as Record<string, unknown>[]);

	const regionLabel = $derived(t(messages, 'approvals.list.title'));
</script>

{#snippet statusCell(row: Record<string, unknown>)}
	{@const s = (row.status ?? 'unknown') as Approval['status']}
	<Badge variant={variantFor(s)} size="sm">{t(messages, statusToI18nKey(s))}</Badge>
{/snippet}

{#snippet ageCell(row: Record<string, unknown>)}
	{formatAge((row.ageSec as number | undefined) ?? 0)}
{/snippet}

<div
	data-slot="approval-list"
	class={className}
	aria-label={regionLabel}
>
	<DataTable
		columns={columns}
		data={rows}
		{pageSize}
		{initialSort}
		{empty}
	/>
</div>
