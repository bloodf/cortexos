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
	import Button from '$lib/components/ui/button/Button.svelte';
	import { t, type Messages } from '$lib/i18n';
	import type { UnitActionKind } from '$lib/components/systemd/adapter';

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
		/** Whether the current user is an admin (gates action buttons). */
		isAdmin?: boolean;
		/** Called when an admin action is triggered for a unit. */
		onAction?: (action: UnitActionKind, unit: string) => void;
		/** Disables all action buttons while an action is in flight. */
		acting?: boolean;
	};

	let {
		units,
		messages,
		pageSize = 25,
		initialSort,
		class: className,
		isAdmin,
		onAction,
		acting,
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
		...(isAdmin
			? [
					{
						key: 'actions',
						header: t(messages, 'systemd.actions.label'),
						sortable: false,
						cell: actionsCell,
					} as Column<Record<string, unknown>>,
				]
			: []),
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

{#snippet actionsCell(row: Record<string, unknown>)}
	<div class="flex items-center gap-1">
		<Button
			size="sm"
			variant="outline"
			onclick={() => onAction?.('enable', row.name as string)}
			disabled={acting || (row.enabled as boolean)}
		>
			{t(messages, 'systemd.actions.enable')}
		</Button>
		<Button
			size="sm"
			variant="outline"
			onclick={() => onAction?.('disable', row.name as string)}
			disabled={acting || !(row.enabled as boolean)}
		>
			{t(messages, 'systemd.actions.disable')}
		</Button>
		{#if row.active === 'active'}
			<Button
				size="sm"
				variant="outline"
				onclick={() => onAction?.('stop', row.name as string)}
				disabled={acting}
			>
				{t(messages, 'systemd.actions.stop')}
			</Button>
		{:else}
			<Button
				size="sm"
				variant="outline"
				onclick={() => onAction?.('start', row.name as string)}
				disabled={acting}
			>
				{t(messages, 'systemd.actions.start')}
			</Button>
		{/if}
		<Button
			size="sm"
			variant="outline"
			onclick={() => onAction?.('restart', row.name as string)}
			disabled={acting}
		>
			{t(messages, 'systemd.actions.restart')}
		</Button>
	</div>
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
