<!--
  /incus — list page.

  Renders a search + filter bar, the list of instances as a
  DataTable, and a "New instance" CTA visible to admins. The
  filter state is URL-driven (the `?q=`, `?status=`, `?type=`
  query params) and pushes via `replaceState` so deep links
  round-trip.

  i18n: every visible string (title, description, empty-state,
  filter labels) routes through `t(data.messages, 'incus.*')`.
-->
<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Server from '$lib/icons/Server.svelte';
  import { t } from '$lib/i18n';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    countByStatus,
    filterByQuery,
    filterByStatus,
    filterByType,
    type StatusFilter,
    type TypeFilter,
    type IncusStatusLit,
  } from '$lib/components/incus/adapter';
  import type { IncusInstance } from '@cortexos/contracts';
  import InstanceList from '$lib/components/incus/InstanceList.svelte';
  import InstanceSearch from '$lib/components/incus/InstanceSearch.svelte';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const title = $derived(t(data.messages, 'incus.title'));
  const description = $derived(t(data.messages, 'incus.description'));
  const emptyDescription = $derived(t(data.messages, 'incus.empty'));
  const newLabel = $derived(t(data.messages, 'incus.new'));

  // Local mirror of the URL search params. The page is the single
  // source of truth. svelte-ignore state_referenced_locally
  // svelte-ignore state_referenced_locally
  // svelte-ignore state_referenced_locally
  let activeQuery = $state<string>(data.q);
  let activeStatus = $state<StatusFilter>(data.status);
  let activeType = $state<TypeFilter>(data.type);

  /**
   * Push the filter state to the URL. Debounced for the query input.
   */
  function pushFilters(): void {
    const params = new URLSearchParams(page.url.searchParams);
    if (activeQuery) params.set('q', activeQuery);
    else params.delete('q');
    if (activeStatus && activeStatus !== 'all') params.set('status', activeStatus);
    else params.delete('status');
    if (activeType && activeType !== 'all') params.set('type', activeType);
    else params.delete('type');
    const search = params.toString();
    void goto(`${page.url.pathname}${search ? '?' + search : ''}`, {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  }

  function onQueryChange(next: string): void {
    activeQuery = next;
    pushFilters();
  }

  function onTypeChange(next: TypeFilter): void {
    activeType = next;
    pushFilters();
  }

  // Counts in the page header (computed from the unfiltered list).
  // We do this client-side over the visible list (the loader
  // already filters; for the header we recompute over all).
  const visible: IncusInstance[] = $derived(
    filterByType(
      filterByStatus(
        filterByQuery(data.instances, activeQuery),
        activeStatus as StatusFilter,
      ),
      activeType,
    ),
  );

  // Header summary uses the unfiltered total.
  const counts = $derived(countByStatus(data.instances));

  // Status filter chips: all + 5 most useful provisioning states.
  const statusChips: IncusStatusLit[] = [
    'draft',
    'provisioning',
    'active',
    'failed',
    'stopped',
  ];
</script>

<svelte:head>
  <title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <PageHeader {title} {description} icon={Server}>
    {#snippet actions()}
      {#if data.isAdmin}
        <a
          href="/incus/wizard"
          data-slot="incus-new"
          class="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {newLabel}
        </a>
      {/if}
    {/snippet}
  </PageHeader>

  <InstanceSearch
    messages={data.messages}
    query={activeQuery}
    type={activeType}
    onQueryChange={onQueryChange}
    onTypeChange={onTypeChange}
  />

  <div
    data-slot="instance-status-filter"
    class="flex flex-wrap items-center gap-2"
    role="group"
    aria-label={t(data.messages, 'incus.filter.label')}
  >
    <button
      type="button"
      data-slot="instance-status-chip"
      data-status="all"
      class={activeStatus === 'all'
        ? 'inline-flex h-7 items-center rounded-md border border-border bg-primary px-3 text-xs font-medium text-primary-foreground'
        : 'inline-flex h-7 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent'}
      aria-pressed={activeStatus === 'all'}
      onclick={() => {
        activeStatus = 'all';
        pushFilters();
      }}
    >
      {t(data.messages, 'incus.filter.all')} ({counts.total})
    </button>
    {#each statusChips as s (s)}
      <button
        type="button"
        data-slot="instance-status-chip"
        data-status={s}
        class={activeStatus === s
          ? 'inline-flex h-7 items-center rounded-md border border-border bg-primary px-3 text-xs font-medium text-primary-foreground'
          : 'inline-flex h-7 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent'}
        aria-pressed={activeStatus === s}
        onclick={() => {
          activeStatus = s;
          pushFilters();
        }}
      >
        {t(data.messages, `incus.status.${s}`)}
      </button>
    {/each}
  </div>

  {#if visible.length === 0}
    <EmptyState
      {title}
      description={emptyDescription}
      icon={Server}
    />
  {:else}
    <InstanceList
      messages={data.messages}
      instances={visible}
      pageSize={25}
    />
  {/if}
</div>
