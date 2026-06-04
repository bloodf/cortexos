<!--
  ContainerList — table view of docker containers, built on the
  design-system DataTable.

  The DataTable primitive owns sort/filter/pagination state. This
  component wires the column definitions (which fields are visible
  and how cells render) and provides a small "open" affordance per
  row for the detail-page navigation.

  Row-click navigation is handled by the page layer via a wrapping
  click handler — this component intentionally does not own
  navigation so it can be reused inside non-link surfaces.

  i18n: pass the locale `messages` map; column headers and the
  region aria-label route through `t(messages, 'docker.*')`.
-->
<script lang="ts" generics="T extends DockerContainer">
  import type { Snippet } from 'svelte';
  import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
  import type { Column, SortDir } from '$lib/components/ui/data-table/DataTable.types';
  import ContainerStateBadge from './ContainerStateBadge.svelte';
  import type { DockerContainer } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import type { ContainerStateLit } from './adapter';

  type Props = {
    /** The rows to display. The component treats them as read-only. */
    containers: readonly T[];
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

  let { containers, messages, pageSize = 25, initialSort, empty, class: className }: Props =
    $props();

  const columns: Column<Record<string, unknown>>[] = $derived([
    { key: 'name', header: t(messages, 'docker.table.name'), sortable: true },
    { key: 'image', header: t(messages, 'docker.table.image'), sortable: true },
    {
      key: 'state',
      header: t(messages, 'docker.table.state'),
      sortable: true,
      cell: stateCell,
    },
    {
      key: 'status',
      header: t(messages, 'docker.table.status'),
      sortable: false,
      cell: statusCell,
    },
    {
      key: 'ports',
      header: t(messages, 'docker.table.ports'),
      sortable: false,
      cell: portsCell,
    },
  ]);

  const rows = $derived(containers as unknown as Record<string, unknown>[]);
  const regionLabel = $derived(t(messages, 'app.nav.docker'));
</script>

{#snippet stateCell(row: Record<string, unknown>)}
  <ContainerStateBadge
    {messages}
    state={row.state as ContainerStateLit}
    size="sm"
  />
{/snippet}

{#snippet statusCell(row: Record<string, unknown>)}
  {@const s = row.status as string | null | undefined}
  <span class="text-muted-foreground">{s ?? '—'}</span>
{/snippet}

{#snippet portsCell(row: Record<string, unknown>)}
  {@const p = row.ports as ReadonlyArray<string> | undefined}
  <span class="font-mono text-xs text-muted-foreground">
    {p && p.length > 0 ? p.join(', ') : '—'}
  </span>
{/snippet}

<div
  data-slot="container-list"
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
