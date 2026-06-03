<!--
  ServiceList — table view of services, built on the design-system
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
  region aria-label route through `t(messages, 'services.*')`.
-->
<script lang="ts" generics="T extends Service">
	import type { Snippet } from 'svelte';
	import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
	import type { Column, SortDir } from '$lib/components/ui/data-table/DataTable.types';
	import ServiceHealthBadge from './ServiceHealthBadge.svelte';
	import type { Service } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import type { ServiceStatusLit } from './adapter';

	type Props = {
		/** The rows to display. The component treats them as read-only. */
		services: readonly T[];
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

	let { services, messages, pageSize = 25, initialSort, empty, class: className }: Props =
		$props();

	// Column headers resolve through t() so they follow the active
	// locale. The DataTable primitive sorts + paginates the data
	// itself; we only define what's *visible* in each column.
	const columns: Column<Record<string, unknown>>[] = $derived([
		{ key: 'name', header: t(messages, 'services.table.name'), sortable: true },
		{ key: 'category', header: t(messages, 'services.table.category'), sortable: true },
		{
			key: 'status',
			header: t(messages, 'services.table.status'),
			sortable: true,
			cell: statusCell,
		},
		{
			key: 'responseMs',
			header: t(messages, 'services.table.response'),
			sortable: true,
			cell: responseCell,
		},
		{
			key: 'uptime24h',
			header: t(messages, 'services.table.uptime'),
			sortable: true,
			cell: uptimeCell,
		},
	]);

	// Cast at the edge: every column key is a real property of T
	// (Service) by construction, and the cell snippets handle the
	// typed property access.
	const rows = $derived(services as unknown as Record<string, unknown>[]);

	const regionLabel = $derived(t(messages, 'app.nav.services'));
</script>

{#snippet statusCell(row: Record<string, unknown>)}
	<ServiceHealthBadge
		{messages}
		status={row.status as ServiceStatusLit}
		size="sm"
	/>
{/snippet}

{#snippet responseCell(row: Record<string, unknown>)}
	{@const ms = row.responseMs as number | null | undefined}
	<span class="text-muted-foreground">{ms == null ? '—' : `${ms}ms`}</span>
{/snippet}

{#snippet uptimeCell(row: Record<string, unknown>)}
	{@const u = row.uptime24h as number | null | undefined}
	<span class="text-muted-foreground">{u == null ? '—' : `${u.toFixed(2)}%`}</span>
{/snippet}

<div
	data-slot="service-list"
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
