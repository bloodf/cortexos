<!--
  InstanceList — table view of Incus instances, built on the
  design-system DataTable.

  The DataTable primitive owns sort/filter/pagination state. This
  component wires the column definitions (which fields are visible
  and how cells render) and provides a small "open" affordance per
  row for the detail-page navigation.

  Row-click navigation is handled by the page layer via a wrapping
  click handler — this component intentionally does not own
  navigation so it can be reused inside non-link surfaces.

  i18n: pass the locale `messages` map; column headers and the
  region aria-label route through `t(messages, 'incus.*')`.
-->
<script lang="ts" generics="T extends IncusInstance">
  import type { Snippet } from 'svelte';
  import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
  import type { Column, SortDir } from '$lib/components/ui/data-table/DataTable.types';
  import type { IncusInstance } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import InstanceStateBadge from './InstanceStateBadge.svelte';
  import { formatResources, type IncusStatusLit } from './adapter';

  type Props = {
    /** The rows to display. The component treats them as read-only. */
    instances: readonly T[];
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Page size — defaults to 25. */
    pageSize?: number;
    /** Initial sort key/direction. */
    initialSort?: { key: string; dir: SortDir };
    /** Optional empty-state snippet. */
    empty?: Snippet;
    /** Optional className passthrough. */
    class?: string;
  };

  let { instances, messages, pageSize = 25, initialSort, empty, class: className }: Props =
    $props();

  const columns: Column<Record<string, unknown>>[] = $derived([
    { key: 'name', header: t(messages, 'incus.table.name'), sortable: true },
    { key: 'type', header: t(messages, 'incus.table.type'), sortable: true },
    { key: 'image', header: t(messages, 'incus.table.image'), sortable: true },
    {
      key: 'status',
      header: t(messages, 'incus.table.status'),
      sortable: true,
      cell: stateCell,
    },
    { key: 'cpu', header: t(messages, 'incus.table.cpu'), sortable: true, cell: cpuCell },
    {
      key: 'memory',
      header: t(messages, 'incus.table.memory'),
      sortable: true,
      cell: memoryCell,
    },
  ]);

  const rows = $derived(instances as unknown as Record<string, unknown>[]);
  const regionLabel = $derived(t(messages, 'app.nav.incus'));
</script>

{#snippet stateCell(row: Record<string, unknown>)}
  <InstanceStateBadge
    {messages}
    state={row.status as IncusStatusLit}
    size="sm"
  />
{/snippet}

{#snippet cpuCell(row: Record<string, unknown>)}
  <span class="text-right tabular-nums font-mono text-xs">
    {row.cpu != null ? `${row.cpu} vCPU` : '—'}
  </span>
{/snippet}

{#snippet memoryCell(row: Record<string, unknown>)}
  {@const r = formatResources({ ...(row as unknown as IncusInstance) })}
  <span class="text-right tabular-nums font-mono text-xs">
    {r.memory}
  </span>
{/snippet}

<div
  data-slot="instance-list"
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
