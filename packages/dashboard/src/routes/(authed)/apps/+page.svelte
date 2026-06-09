<script lang="ts">
	import type { PageData } from './$types';
	import type { Service } from '@cortexos/contracts';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Card from '$lib/components/ui/card/Card.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Container from '$lib/icons/Container.svelte';
	import Search from '$lib/icons/Search.svelte';
	import StatusBadge from '$lib/components/ui/status-badge/StatusBadge.svelte';
	import TechIcon from '$lib/components/ui/tech-icon/TechIcon.svelte';
	import { t } from '$lib/i18n';
	import type { ServiceStatusLit } from '$lib/components/services/adapter';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Seed the working list from the server load once; the /api/services
	// poll below keeps it fresh. Read through a plain const so the
	// snapshot is explicit, not a missed reactive capture.
	const initialServices: Service[] = data.services ?? [];
	let services = $state<Service[]>(initialServices);
	let isLoading = $state(false);
	let q = $state('');
	let cat = $state<string>('All');
	let statusFilter = $state<'all' | 'online' | 'offline' | 'unknown'>('all');
	let view = $state<'grid' | 'list'>('grid');
	let favSlugs = $state<Set<string>>(new Set());

	$effect(() => {
		if (typeof window === 'undefined') return;
		const raw = window.localStorage.getItem('cortexos-apps-favorites');
		if (!raw) return;
		try {
			favSlugs = new Set(JSON.parse(raw) as string[]);
		} catch {
			// ignore malformed localStorage
		}
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(
			'cortexos-apps-favorites',
			JSON.stringify(Array.from(favSlugs))
		);
	});

	async function fetchServices() {
		try {
			const r = await fetch('/api/services', { credentials: 'include' });
			if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
			const json = (await r.json()) as { services: Service[] };
			services = json.services ?? [];
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error('[apps poll]', e);
		}
	}

	$effect(() => {
		void fetchServices();
		const id = setInterval(() => void fetchServices(), 3000);
		return () => clearInterval(id);
	});

	const categories = $derived([
		'All',
		...Array.from(new Set(services.map((s) => s.category))).sort(),
	]);
	const filtered = $derived(
		services.filter((s) => {
			if (cat !== 'All' && s.category !== cat) return false;
			if (statusFilter !== 'all' && s.status !== statusFilter) return false;
			const needle = q.toLowerCase();
			if (
				needle &&
				!(s.name.toLowerCase().includes(needle) ||
					s.slug.toLowerCase().includes(needle) ||
					(s.description ?? '').toLowerCase().includes(needle))
			) {
				return false;
			}
			return true;
		})
	);
	const favs = $derived(filtered.filter((s) => favSlugs.has(s.slug)));
	const rest = $derived(filtered.filter((s) => !favSlugs.has(s.slug)));
	const onlineCount = $derived(services.filter((s) => s.status === 'online').length);

	function toggleFavorite(slug: string) {
		const next = new Set(favSlugs);
		if (next.has(slug)) next.delete(slug);
		else next.add(slug);
		favSlugs = next;
	}

	const title = $derived(t(data.messages, 'app.nav.apps'));
	const pageTitle = $derived(t(data.messages, 'apps.title'));
	const searchPlaceholder = $derived(t(data.messages, 'apps.searchPlaceholder'));
	const emptyTitle = $derived(t(data.messages, 'apps.empty.title'));
	const emptyDescription = $derived(t(data.messages, 'apps.empty.description'));
	const openLabel = $derived(t(data.messages, 'apps.open'));
	const favoritesLabel = $derived(t(data.messages, 'apps.favorites'));
	const allAppsLabel = $derived(t(data.messages, 'apps.allApps'));
	const allLabel = $derived(t(data.messages, 'apps.filter.all'));
	const onlineLabel = $derived(t(data.messages, 'apps.filter.online'));
	const offlineLabel = $derived(t(data.messages, 'apps.filter.offline'));
	const unknownLabel = $derived(t(data.messages, 'apps.filter.unknown'));
</script>

<svelte:head>
	<title>{pageTitle} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-5">
	<PageHeader
		{title}
		description="{services.length} apps · {onlineCount} online"
		icon={Container}
	>
		{#snippet actions()}
			<div class="flex gap-1 rounded-md border p-0.5 bg-muted/30">
				<Button
					size="sm"
					variant={view === 'grid' ? 'default' : 'ghost'}
					onclick={() => (view = 'grid')}
					ariaLabel="Grid view"
					class="h-7 px-2"
				>
					<span class="text-sm">⊞</span>
				</Button>
				<Button
					size="sm"
					variant={view === 'list' ? 'default' : 'ghost'}
					onclick={() => (view = 'list')}
					ariaLabel="List view"
					class="h-7 px-2"
				>
					<span class="text-sm">☰</span>
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<div class="flex flex-wrap items-center gap-2">
		<div class="relative flex-1 min-w-[200px] max-w-md">
			<Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			<Input
				type="search"
				bind:value={q}
				placeholder={searchPlaceholder}
				class="pl-8"
			/>
		</div>
		<div class="flex flex-wrap gap-1">
			{#each categories as c (c)}
				<button
					type="button"
					onclick={() => (cat = c)}
					class={cat === c
						? 'rounded-full px-3 py-1 text-xs border bg-primary text-primary-foreground border-primary transition-colors'
						: 'rounded-full px-3 py-1 text-xs border hover:bg-muted transition-colors'}
				>
					{c}
				</button>
			{/each}
		</div>
		<div class="flex gap-1 ml-auto">
			{#each [['all', allLabel], ['online', onlineLabel], ['offline', offlineLabel], ['unknown', unknownLabel]] as [value, label]}
				<button
					type="button"
					onclick={() => (statusFilter = value as typeof statusFilter)}
					class={statusFilter === value
						? 'rounded-full px-3 py-1 text-xs border bg-accent text-accent-foreground border-accent transition-colors'
						: 'rounded-full px-3 py-1 text-xs border hover:bg-muted transition-colors'}
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	{#if filtered.length === 0}
		<EmptyState title={emptyTitle} description={emptyDescription} icon={Container} />
	{:else}
		<div class="space-y-6">
			{#if favs.length > 0}
				<section>
					<p class="text-xs uppercase tracking-wider text-muted-foreground mb-2">
						{favoritesLabel}
					</p>
					{@render ServiceList({ items: favs, view })}
				</section>
			{/if}
			<section>
				{#if favs.length > 0}
					<p class="text-xs uppercase tracking-wider text-muted-foreground mb-2">
						{allAppsLabel}
					</p>
				{/if}
				{@render ServiceList({ items: rest, view })}
			</section>
		</div>
	{/if}
</div>

{#snippet ServiceList({ items, view }: { items: Service[]; view: 'grid' | 'list' })}
	{#if view === 'list'}
		<Card class="divide-y">
			{#each items as s (s.slug)}
				<div class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
					<TechIcon name={s.name} slug={s.slug} size={32} image={s.icon?.image} />
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="font-medium text-sm truncate">{s.name}</span>
							<Badge variant="outline" size="sm">{s.category}</Badge>
						</div>
						<p class="text-xs text-muted-foreground truncate">
							{s.description ?? ''}
						</p>
					</div>
					<StatusBadge
						status={s.status as ServiceStatusLit}
						messages={data.messages}
						responseMs={s.responseMs ?? null}
						compact
					/>
					<button
						type="button"
						onclick={() => toggleFavorite(s.slug)}
						class="text-muted-foreground hover:text-foreground"
						aria-label={favSlugs.has(s.slug) ? 'Remove favorite' : 'Add favorite'}
					>
						{#if favSlugs.has(s.slug)}
							<svg viewBox="0 0 24 24" class="h-4 w-4 fill-current text-warning">
								<path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
							</svg>
						{:else}
							<svg
								viewBox="0 0 24 24"
								class="h-4 w-4"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
							</svg>
						{/if}
					</button>
					<a
						href={s.openUrl ?? '#'}
						target="_blank"
						rel="noreferrer"
						class="text-muted-foreground hover:text-foreground"
						aria-label="{openLabel} — {s.name}"
					>
						<span class="text-lg leading-none">↗</span>
					</a>
				</div>
			{/each}
		</Card>
	{:else}
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
			{#each items as s (s.slug)}
				<Card class="p-4 relative group hover:border-primary/30 transition-all">
					<button
						type="button"
						onclick={() => toggleFavorite(s.slug)}
						class="absolute top-2 right-2 opacity-60 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
						aria-label={favSlugs.has(s.slug) ? 'Remove favorite' : 'Add favorite'}
					>
						{#if favSlugs.has(s.slug)}
							<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 fill-current text-warning">
								<path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
							</svg>
						{:else}
							<svg
								viewBox="0 0 24 24"
								class="h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
							</svg>
						{/if}
					</button>
					<div class="flex items-start gap-3">
						<TechIcon name={s.name} slug={s.slug} size={40} image={s.icon?.image} />
						<div class="min-w-0 flex-1">
							<h3 class="font-semibold text-sm truncate pr-5">{s.name}</h3>
							<p class="text-[10px] text-muted-foreground uppercase tracking-wide">
								{s.category}
							</p>
						</div>
					</div>
					<p class="mt-2 text-xs text-muted-foreground line-clamp-2 min-h-10">
						{s.description ?? ''}
					</p>
					{#if s.badges && s.badges.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each s.badges.slice(0, 3) as badge (badge.slug)}
								<span
									class="rounded-full px-2 py-0.5 text-[10px] font-medium"
									style={badge.color
										? `background-color: ${badge.color}22; color: ${badge.color};`
										: ''}
								>
									{badge.label}
								</span>
							{/each}
						</div>
					{/if}
					<div class="mt-3 flex items-center justify-between gap-2">
						<StatusBadge
							status={s.status as ServiceStatusLit}
							messages={data.messages}
							responseMs={s.responseMs ?? null}
							compact
						/>
						<a
							href={s.openUrl ?? '#'}
							target="_blank"
							rel="noreferrer"
							class="text-xs text-primary hover:underline flex items-center gap-1"
						>
							{openLabel}
							<span class="text-sm leading-none">↗</span>
						</a>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
{/snippet}
