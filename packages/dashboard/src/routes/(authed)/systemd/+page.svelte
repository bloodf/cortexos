<!--
  /systemd — list page.

  Renders a state-filtered list of units. The filter is URL-driven
  (the `?state=` query param) and pushes via `replaceState` so deep
  links round-trip. The DataTable primitive owns sort + pagination
  state internally.

  i18n: every visible string (title, description, empty-state,
  filter labels) routes through `t(data.messages, 'systemd.*')`,
  matching the M1 main pattern.
-->
<script lang="ts">
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Server from '$lib/icons/Server.svelte';
	import UnitList from '$lib/components/systemd/UnitList.svelte';
	import { t } from '$lib/i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { filterByState, type StateFilter } from '$lib/components/systemd/adapter';
	import type { SystemdUnit } from '@cortexos/contracts';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Title follows the M1 pattern: t(data.messages, 'app.nav.systemd').
	const title = $derived(t(data.messages, 'app.nav.systemd'));
	const description = $derived(t(data.messages, 'systemd.description'));
	const emptyDescription = $derived(t(data.messages, 'systemd.empty'));

	// Local mirror of the URL search params — the only inputs the
	// filter chips need. The page is the single source of truth.
	// svelte-ignore state_referenced_locally -- intentional: data is a prop and the initial value only
	let activeState = $state<StateFilter>(data.state);

	function applyFilter(next: StateFilter): void {
		activeState = next;
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (next && next !== 'all') params.set('state', next);
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
	// matching rows (and the count is right in the page header).
	const visible: SystemdUnit[] = $derived(filterByState(data.units, activeState));

	// Filter-chip labels.
	const filterAll = $derived(t(data.messages, 'systemd.filter.all'));
	const filterActive = $derived(t(data.messages, 'systemd.filter.active'));
	const filterInactive = $derived(t(data.messages, 'systemd.filter.inactive'));
	const filterFailed = $derived(t(data.messages, 'systemd.filter.failed'));

	function chipClass(state: StateFilter): string {
		return activeState === state
			? 'inline-flex h-7 items-center rounded-md border border-border bg-primary px-3 text-xs font-medium text-primary-foreground'
			: 'inline-flex h-7 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent';
	}
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		{description}
		icon={Server}
	/>

	<div
		data-slot="unit-filter-bar"
		class="flex flex-wrap items-center gap-2"
		role="group"
		aria-label={t(data.messages, 'systemd.filter.label')}
	>
		<button
			type="button"
			data-slot="unit-filter-chip"
			data-state="all"
			class={chipClass('all')}
			aria-pressed={activeState === 'all'}
			onclick={() => applyFilter('all')}
		>
			{filterAll} ({data.counts.total})
		</button>
		<button
			type="button"
			data-slot="unit-filter-chip"
			data-state="active"
			class={chipClass('active')}
			aria-pressed={activeState === 'active'}
			onclick={() => applyFilter('active')}
		>
			{filterActive} ({data.counts.active})
		</button>
		<button
			type="button"
			data-slot="unit-filter-chip"
			data-state="inactive"
			class={chipClass('inactive')}
			aria-pressed={activeState === 'inactive'}
			onclick={() => applyFilter('inactive')}
		>
			{filterInactive} ({data.counts.inactive})
		</button>
		<button
			type="button"
			data-slot="unit-filter-chip"
			data-state="failed"
			class={chipClass('failed')}
			aria-pressed={activeState === 'failed'}
			onclick={() => applyFilter('failed')}
		>
			{filterFailed} ({data.counts.failed})
		</button>
	</div>

	{#if visible.length === 0}
		<EmptyState
			{title}
			description={emptyDescription}
			icon={Server}
		/>
	{:else}
		<UnitList messages={data.messages} units={visible} pageSize={25} />
	{/if}
</div>
