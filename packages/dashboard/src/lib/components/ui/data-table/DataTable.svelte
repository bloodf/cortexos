<!--
  DataTable — high-level typed table with sort + filter + pagination state.

  Usage:
    type Row = { id: string; name: string; age: number };
    const columns: Column<Row>[] = [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'age',  header: 'Age',  sortable: true },
    ];
    <DataTable {columns} data={rows} pageSize={10} />

  State pattern follows the migration map (§3 "DataTable") — local $state in
  the component, derived view = sort + filter + paginate(data).
-->
<script lang="ts" generics="T extends Record<string, unknown>">
  import type { Snippet } from 'svelte';
  import { tv } from '$lib/utils/tv';
  import { cn } from '$lib/utils/cn';
  import Table from '../table/Table.svelte';
  import TableHeader from '../table/TableHeader.svelte';
  import TableBody from '../table/TableBody.svelte';
  import TableRow from '../table/TableRow.svelte';
  import TableHead from '../table/TableHead.svelte';
  import TableCell from '../table/TableCell.svelte';
  import Input from '../input/Input.svelte';
  import Button from '../button/Button.svelte';
  import type { Column, SortDir } from './DataTable.types';

  type Props = {
    columns: Column<T>[];
    data: T[];
    pageSize?: number;
    initialSort?: { key: keyof T & string; dir: SortDir };
    /** Custom empty-state snippet. */
    empty?: Snippet;
    class?: string;
  };
  let {
    columns,
    data,
    pageSize = 25,
    initialSort,
    empty,
    class: className,
  }: Props = $props();

  // Local state — the "table-state" pattern from the migration map.
  // svelte-ignore state_referenced_locally -- intentional: initial value only
  let filter = $state('');
  // svelte-ignore state_referenced_locally -- intentional: initial value only
  let sortKey = $state<string | null>(initialSort?.key ?? null);
  // svelte-ignore state_referenced_locally -- intentional: initial value only
  let sortDir = $state<SortDir>(initialSort?.dir ?? 'asc');
  let page = $state(0);

  const filtered = $derived.by(() => {
    if (!filter) return data;
    const needle = filter.toLowerCase();
    return data.filter((row) =>
      columns.some((c) => String(row[c.key] ?? '').toLowerCase().includes(needle)),
    );
  });
  const sorted = $derived.by(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    const cmp =
      col?.sortFn ??
      ((a: T, b: T) => {
        const av = a[sortKey as keyof T];
        const bv = b[sortKey as keyof T];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return av - bv;
        return String(av).localeCompare(String(bv));
      });
    return [...filtered].sort((a, b) => {
      const r = cmp(a, b);
      return sortDir === 'asc' ? r : -r;
    });
  });
  const pageCount = $derived(Math.max(1, Math.ceil(sorted.length / pageSize)));
  const view = $derived(sorted.slice(page * pageSize, page * pageSize + pageSize));

  function toggleSort(key: string) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
  }

  const tableClasses = tv({ base: 'w-full caption-bottom text-sm' });
</script>

<div data-slot="data-table" class={cn('flex flex-col gap-2', className)}>
  <div class="flex items-center gap-2">
    <Input bind:value={filter} placeholder="Filter..." class="max-w-xs" />
    <span class="text-xs text-muted-foreground">
      {sorted.length} {sorted.length === 1 ? 'row' : 'rows'}
    </span>
  </div>

  <Table>
    <TableHeader>
      <TableRow>
        {#each columns as col (col.key)}
          <TableHead>
            {#if col.sortable}
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-foreground"
                onclick={() => toggleSort(col.key)}
                aria-label="Sort by {col.header}"
              >
                {col.header}
                {#if sortKey === col.key}
                  <span aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </button>
            {:else}
              {col.header}
            {/if}
          </TableHead>
        {/each}
      </TableRow>
    </TableHeader>
    <TableBody>
      {#if view.length === 0}
        <TableRow>
          <TableCell class="text-center text-muted-foreground" >
            {#if empty}{@render empty()}{:else}No results.{/if}
          </TableCell>
        </TableRow>
      {:else}
        {#each view as row, i (i)}
          <TableRow>
            {#each columns as col (col.key)}
              <TableCell>
                {#if col.cell}{@render col.cell(row, i)}{:else}{String(row[col.key] ?? '')}{/if}
              </TableCell>
            {/each}
          </TableRow>
        {/each}
      {/if}
    </TableBody>
  </Table>

  {#if pageCount > 1}
    <div class="flex items-center justify-end gap-2 text-xs">
      <Button
        size="sm"
        variant="outline"
        disabled={page === 0}
        onclick={() => (page = Math.max(0, page - 1))}
      >
        Prev
      </Button>
      <span class="text-muted-foreground">Page {page + 1} / {pageCount}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pageCount - 1}
        onclick={() => (page = Math.min(pageCount - 1, page + 1))}
      >
        Next
      </Button>
    </div>
  {/if}
</div>
