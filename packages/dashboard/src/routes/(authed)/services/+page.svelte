/**
 * /services — list page.
 *
 * Renders a searchable / sortable list of services using the
 * `ServiceSearch` and `ServiceList` components. The search bar
 * pushes query/category into the URL (replaceState) so deep links
 * round-trip; the table owns sort + pagination state internally.
 */
<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PlugZap from '$lib/icons/PlugZap.svelte';
	import ServiceSearch from '$lib/components/services/ServiceSearch.svelte';
	import ServiceList from '$lib/components/services/ServiceList.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Service } from '@cortexos/contracts';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = 'Services';

	// Local mirror of the URL search params — these are the only
	// inputs ServiceSearch needs. The page is the single source of
	// truth: ServiceSearch's `query` + `category` props flow down
	// and any user edits flow back up via `onChange`, which updates
	// the URL.
	// svelte-ignore state_referenced_locally -- intentional: data is a prop and the initial value only
	let q = $state(data.initialQuery);
	// svelte-ignore state_referenced_locally -- intentional: data is a prop and the initial value only
	let cat = $state(data.initialCategory);

	function applyFilter(next: { query: string; category: string }): void {
		q = next.query;
		cat = next.category;
		const params = new URLSearchParams(page.url.searchParams);
		if (next.query) params.set('q', next.query);
		else params.delete('q');
		if (next.category) params.set('category', next.category);
		else params.delete('category');
		const search = params.toString();
		// Use `replaceState` so back/forward don't fill up with each
		// keystroke; the URL is the canonical record of the filter.
		void goto(`${page.url.pathname}${search ? '?' + search : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
		});
	}

	// Client-side filter. The DataTable also does free-text filter,
	// but we apply the category filter here so the table sees only
	// the matching rows (and the count is right in the page header).
	const visible: Service[] = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return data.services.filter((s) => {
			if (cat && s.category !== cat) return false;
			if (!needle) return true;
			return (
				s.name.toLowerCase().includes(needle) ||
				s.slug.toLowerCase().includes(needle) ||
				(s.description ?? '').toLowerCase().includes(needle)
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
		description="Track every systemd unit and Docker container CortexOS knows about."
		icon={PlugZap}
	/>

	<ServiceSearch
		query={q}
		category={cat}
		categories={data.categories}
		onChange={applyFilter}
	/>

	{#if visible.length === 0}
		<EmptyState
			{title}
			description="No services match the current filter. Clear the filter to see all services."
			icon={PlugZap}
		/>
	{:else}
		<ServiceList services={visible} pageSize={25} />
	{/if}
</div>
