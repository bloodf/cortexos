<!--
  /docker — list page with tabs for Containers, Images, and Volumes.

  Renders a searchable / sortable list of docker containers using
  the `ContainerSearch` and `ContainerList` components, plus tables
  for Images and Volumes. The search bar pushes query/state into
  the URL (replaceState) so deep links round-trip; the table owns
  sort + pagination state internally.

  i18n: every visible string routes through `t(data.messages, 'docker.*')`.
-->
<script lang="ts">
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Container from '$lib/icons/Container.svelte';
  import ContainerSearch from '$lib/components/docker/ContainerSearch.svelte';
  import ContainerList from '$lib/components/docker/ContainerList.svelte';
  import { t } from '$lib/i18n';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { DockerContainer } from '@cortexos/contracts';
  import { Tabs, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
  import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
  import { Card, CardBody } from '$lib/components/ui/card';
  import Badge from '$lib/components/ui/badge/Badge.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { bytes } from '$lib/utils/format';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const title = $derived(t(data.messages, 'app.nav.docker'));
  const description = $derived(t(data.messages, 'docker.description'));
  const emptyDescription = $derived(t(data.messages, 'docker.empty'));

  // Local mirror of the URL search params — these are the only
  // inputs ContainerSearch needs. The page is the single source of
  // truth: ContainerSearch's `query` + `stateFilter` props flow down and
  // any user edits flow back up via `onChange`, which updates the URL.
  // svelte-ignore state_referenced_locally -- intentional initial value
  let q = $state(data.initialQuery);
  // svelte-ignore state_referenced_locally -- intentional initial value
  let st = $state(data.initialState as 'all' | 'running' | 'stopped' | 'paused' | 'restarting');

  function applyFilter(next: { query: string; stateFilter: typeof st }): void {
    q = next.query;
    st = next.stateFilter;
    const params = new SvelteURLSearchParams(page.url.searchParams);
    if (next.query) params.set('q', next.query);
    else params.delete('q');
    if (next.stateFilter && next.stateFilter !== 'all') params.set('state', next.stateFilter);
    else params.delete('state');
    const search = params.toString();
    void goto(`${page.url.pathname}${search ? '?' + search : ''}`, {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  }

  // Client-side filter. The DataTable also does free-text filter,
  // but we apply the state filter here so the table sees only the
  // matching rows.
  const visible: DockerContainer[] = $derived.by(() => {
    const needle = q.trim().toLowerCase();
    return data.containers.filter((c) => {
      if (st === 'running' && c.state !== 'running') return false;
      if (st === 'stopped' && !(c.state === 'exited' || c.state === 'created' || c.state === 'dead'))
        return false;
      if (st === 'paused' && c.state !== 'paused') return false;
      if (st === 'restarting' && c.state !== 'restarting') return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.image.toLowerCase().includes(needle) ||
        c.state.toLowerCase().includes(needle)
      );
    });
  });

  // Summary counts
  const summary = $derived.by(() => {
    const total = data.containers.length;
    const running = data.containers.filter((c) => c.state === 'running').length;
    const paused = data.containers.filter((c) => c.state === 'paused').length;
    const stopped = data.containers.filter(
      (c) => c.state === 'exited' || c.state === 'created' || c.state === 'dead',
    ).length;
    return { total, running, paused, stopped };
  });

  // Tabs
  type Tab = 'containers' | 'images' | 'volumes';
  let activeTab = $state<Tab>('containers');

  // Images filter
  let imageFilter = $state('');
  const filteredImages = $derived.by(() => {
    const needle = imageFilter.trim().toLowerCase();
    if (!needle) return data.images;
    return data.images.filter(
      (i) =>
        i.repo.toLowerCase().includes(needle) ||
        i.tag.toLowerCase().includes(needle) ||
        i.id.toLowerCase().includes(needle),
    );
  });

  // Volumes filter
  let volumeFilter = $state('');
  const filteredVolumes = $derived.by(() => {
    const needle = volumeFilter.trim().toLowerCase();
    if (!needle) return data.volumes;
    return data.volumes.filter(
      (v) =>
        v.name.toLowerCase().includes(needle) ||
        v.driver.toLowerCase().includes(needle) ||
        v.mountpoint.toLowerCase().includes(needle),
    );
  });

  const imageColumns = $derived([
    { key: 'repo', header: t(data.messages, 'docker.images.table.repository'), sortable: true },
    { key: 'tag', header: t(data.messages, 'docker.images.table.tag'), sortable: true },
    {
      key: 'size',
      header: t(data.messages, 'docker.images.table.size'),
      sortable: true,
      cell: imageSizeCell,
    },
    { key: 'created', header: t(data.messages, 'docker.images.table.created'), sortable: true },
  ]);

  const volumeColumns = $derived([
    { key: 'name', header: t(data.messages, 'docker.volumes.table.name'), sortable: true },
    { key: 'driver', header: t(data.messages, 'docker.volumes.table.driver'), sortable: true },
    {
      key: 'mountpoint',
      header: t(data.messages, 'docker.volumes.table.mountpoint'),
      sortable: true,
    },
    {
      key: 'size',
      header: t(data.messages, 'docker.volumes.table.size'),
      sortable: true,
      cell: volumeSizeCell,
    },
  ]);
</script>

{#snippet imageSizeCell(row: Record<string, unknown>)}
  {bytes(row.size as number)}
{/snippet}

{#snippet volumeSizeCell(row: Record<string, unknown>)}
  {row.size != null ? bytes(row.size as number) : '—'}
{/snippet}

<svelte:head>
  <title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <PageHeader {title} {description} icon={Container} />

  <!-- Summary bar -->
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <Card>
      <CardBody class="flex flex-col items-center gap-1 p-4">
        <span class="text-sm text-muted-foreground">{t(data.messages, 'docker.summary.total')}</span>
        <span class="text-2xl font-semibold">{summary.total}</span>
      </CardBody>
    </Card>
    <Card>
      <CardBody class="flex flex-col items-center gap-1 p-4">
        <span class="text-sm text-muted-foreground">{t(data.messages, 'docker.summary.running')}</span>
        <Badge variant="success" size="sm">{summary.running}</Badge>
      </CardBody>
    </Card>
    <Card>
      <CardBody class="flex flex-col items-center gap-1 p-4">
        <span class="text-sm text-muted-foreground">{t(data.messages, 'docker.summary.paused')}</span>
        <Badge variant="info" size="sm">{summary.paused}</Badge>
      </CardBody>
    </Card>
    <Card>
      <CardBody class="flex flex-col items-center gap-1 p-4">
        <span class="text-sm text-muted-foreground">{t(data.messages, 'docker.summary.stopped')}</span>
        <Badge variant="destructive" size="sm">{summary.stopped}</Badge>
      </CardBody>
    </Card>
  </div>

  <Tabs bind:value={activeTab} class="border-border flex gap-1 border-b">
    <TabsTrigger value="containers" bind:selected={activeTab}>
      {t(data.messages, 'docker.tabs.containers')}
    </TabsTrigger>
    <TabsTrigger value="images" bind:selected={activeTab}>
      {t(data.messages, 'docker.tabs.images')}
    </TabsTrigger>
    <TabsTrigger value="volumes" bind:selected={activeTab}>
      {t(data.messages, 'docker.tabs.volumes')}
    </TabsTrigger>
  </Tabs>

  <TabsContent value="containers" selected={activeTab}>
    <ContainerSearch
      messages={data.messages}
      query={q}
      stateFilter={st}
      onChange={applyFilter}
    />

    {#if visible.length === 0}
      <EmptyState
        {title}
        description={emptyDescription}
        icon={Container}
      />
    {:else}
      <ContainerList messages={data.messages} containers={visible} pageSize={25} />
    {/if}
  </TabsContent>

  <TabsContent value="images" selected={activeTab}>
    <div class="flex items-center gap-2">
      <Input
        type="search"
        placeholder="Filter images…"
        bind:value={imageFilter}
        class="max-w-md"
      />
    </div>
    {#if filteredImages.length === 0}
      <EmptyState
        title={t(data.messages, 'docker.tabs.images')}
        description={t(data.messages, 'docker.images.empty')}
        icon={Container}
      />
    {:else}
      <DataTable
        columns={imageColumns}
        data={filteredImages as unknown as Record<string, unknown>[]}
        pageSize={25}
      />
    {/if}
  </TabsContent>

  <TabsContent value="volumes" selected={activeTab}>
    <div class="flex items-center gap-2">
      <Input
        type="search"
        placeholder="Filter volumes…"
        bind:value={volumeFilter}
        class="max-w-md"
      />
    </div>
    {#if filteredVolumes.length === 0}
      <EmptyState
        title={t(data.messages, 'docker.tabs.volumes')}
        description={t(data.messages, 'docker.volumes.empty')}
        icon={Container}
      />
    {:else}
      <DataTable
        columns={volumeColumns}
        data={filteredVolumes as unknown as Record<string, unknown>[]}
        pageSize={25}
      />
    {/if}
  </TabsContent>
</div>
