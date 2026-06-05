<!--
  /audit — admin-gated audit log list with URL-driven filters.

  The page is fully controlled: filters live in the URL (?actor, ?surface,
  ?action, ?result, ?since, ?until), and the AuditFilters component is
  the only mutator of those URL params. The list view is therefore
  shareable — copy the URL, send it to another admin, and they see the
  same filtered view.

  The "Export CSV" link in the header carries the same query string so
  the export matches the filtered view.
-->
<script lang="ts">
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import AuditFilters from '$lib/components/audit/AuditFilters.svelte';
	import AuditLogList from '$lib/components/audit/AuditLogList.svelte';
	import type { AuditFiltersValue } from '$lib/components/audit/AuditFilters.svelte';
	import ScrollText from '$lib/icons/ScrollText.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'audit.title'));
	const description = $derived(t(data.messages, 'audit.description'));
	const exportLabel = $derived(t(data.messages, 'audit.export.button'));

	function currentFilters(): AuditFiltersValue {
		return {
			actor: data.filters.actor,
			surface: data.filters.surface,
			action: data.filters.action,
			result: data.filters.result ?? '',
			since: data.filters.since ?? '',
			until: data.filters.until ?? '',
		};
	}

	/**
	 * Commit a new filter set by re-navigating with the relevant
	 * searchParams. Empty values are dropped so the URL stays clean.
	 */
	function applyFilters(next: AuditFiltersValue): void {
		const params = new SvelteURLSearchParams();
		if (next.actor) params.set('actor', next.actor);
		if (next.surface) params.set('surface', next.surface);
		if (next.action) params.set('action', next.action);
		if (next.result) params.set('result', next.result);
		if (next.since) params.set('since', next.since);
		if (next.until) params.set('until', next.until);
		const qs = params.toString();
		goto(`/audit${qs ? `?${qs}` : ''}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// Re-derived on every navigation so the filter bar tracks the URL.
	const filterValue = $derived(currentFilters());
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div data-slot="audit-page" class="flex flex-col gap-6">
	<PageHeader
		{title}
		{description}
		icon={ScrollText}
		breadcrumbs={[
			{ label: t(data.messages, 'app.nav.dashboard'), href: '/dashboard' },
			{ label: title },
		]}
	/>
	{#snippet headerActions()}
		<a
			href={data.exportUrl}
			data-slot="audit-export-csv"
			class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<ScrollText class="h-4 w-4" />
			<span>{exportLabel}</span>
		</a>
		<a
			href="/audit/verify"
			class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<span>chain verify</span>
		</a>
	{/snippet}

	<section class="flex flex-col gap-4">
		<AuditFilters
			value={filterValue}
			surfaces={data.surfaces}
			actions={data.actions}
			messages={data.messages}
			onChange={applyFilters}
		/>
		<AuditLogList events={data.events} messages={data.messages} />
	</section>
</div>
