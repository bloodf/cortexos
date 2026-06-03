<!--
  UnitList — table view of systemd units, built on the design-system
  DataTable.

  The DataTable primitive owns sort/filter/pagination state. This
  component wires the column definitions (which fields are visible
  and how cells render) and provides the visible structure.

  Row-click navigation is handled by the page layer via a wrapping
  click handler — this component intentionally does not own
  navigation so it can be reused inside non-link surfaces (e.g. an
  admin table that opens a side panel).

  i18n: pass the locale `messages` map; column headers and the
  region aria-label route through `t(messages, 'systemd.*')`.
-->
<script lang="ts" generics="T extends { name: string; active: string; enabled: boolean; [k: string]: unknown }">
	import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
	import type { Column, SortDir } from '$lib/components/ui/data-table/DataTable.types';
	import UnitStateBadge from './UnitStateBadge.svelte';
	import { t, type Messages } from '$lib/i18n';

	type Props = {
		/** The rows to display. The component treats them as read-only. */
		units: readonly T[];
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Page size — defaults to 25. */
		pageSize?: number;
		/** Initial sort key/direction. */
		initialSort?: { key: string; dir: SortDir };
		/** Optional className passthrough. */
		class?: string;
	};

	let {
		units,
		messages,
		pageSize = 25,
		initialSort,
		class: className,
	}: Props = $props();

	// Column headers resolve through t() so they follow the active
	// locale. The DataTable primitive sorts + paginates the data
	// itself; we only define what's *visible* in each column.
	const columns: Column<Record<string, unknown>>[] = $derived([
		{ key: 'name', header: t(messages, 'systemd.table.name'), sortable: true },
		{ key: 'description', header: t(messages, 'systemd.table.description'), sortable: true },
		{
			key: 'active',
			header: t(messages, 'systemd.table.active'),
			sortable: true,
			cell: stateCell,
		},
		{
			key: 'sub',
			header: t(messages, 'systemd.table.sub'),
			sortable: true,
		},
		{
			key: 'enabled',
			header: t(messages, 'systemd.table.enabled'),
			sortable: true,
			cell: enabledCell,
		},
	]);

	// Cast at the edge: every column key is a real property of T
	// (SystemdUnit) by construction, and the cell snippets handle
	// the typed property access.
	const rows = $derived(units as unknown as Record<string, unknown>[]);

	const regionLabel = $derived(t(messages, 'app.nav.systemd'));
</script>

{#snippet stateCell(row: Record<string, unknown>)}
	<UnitStateBadge
		{messages}
		state={row.active as 'active' | 'inactive' | 'failed' | 'activating' | 'deactivating' | 'reloading' | 'maintenance' | 'unknown'}
		size="sm"
	/>
{/snippet}

{#snippet enabledCell(row: Record<string, unknown>)}
	<span data-slot="unit-enabled" data-enabled={String(row.enabled)}>
		{row.enabled
			? t(messages, 'systemd.status.enabled')
			: t(messages, 'systemd.status.disabled')}
	</span>
{/snippet}

<div
	data-slot="unit-list"
	class={className}
	aria-label={regionLabel}
>
	<DataTable
		columns={columns}
		data={rows}
		{pageSize}
		{initialSort}
	/>
</div>
