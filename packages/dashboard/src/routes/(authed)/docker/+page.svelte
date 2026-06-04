<!--
  /docker — list page.

  Renders a searchable / sortable list of docker containers using
  the `ContainerSearch` and `ContainerList` components. The search
  bar pushes query/state into the URL (replaceState) so deep links
  round-trip; the table owns sort + pagination state internally.

  i18n: every visible string (title, description, empty-state)
  routes through `t(data.messages, 'app.nav.*' | 'docker.*')`,
  matching the M1 main pattern.
-->
<script lang="ts">
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

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  // Title follows the M1 pattern: t(data.messages, 'app.nav.docker').
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
    const params = new URLSearchParams(page.url.searchParams);
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
</script>

<svelte:head>
  <title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <PageHeader
    {title}
    {description}
    icon={Container}
  />

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
</div>
