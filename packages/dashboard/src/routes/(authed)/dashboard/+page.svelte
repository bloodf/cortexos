<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$lib/components/ui/Card.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import { t } from '$lib/i18n';
	import Activity from '$lib/icons/Activity.svelte';
	import Server from '$lib/icons/Server.svelte';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>{t(data.messages, 'dashboard.title')} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6" data-testid="dashboard-welcome">
	<PageHeader
		title={t(data.messages, 'dashboard.title')}
		description={t(data.messages, 'dashboard.subtitle')}
		icon={Activity}
	/>

	<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="M1 placeholder metrics">
		<StatCard label="M1 status" value="Online" hint="build ready" trend="up" icon={Activity} />
		<StatCard
			label="Services tracked"
			value="—"
			hint="wired in M2"
			icon={Server}
		/>
		<StatCard label="Active alerts" value="0" hint="alert engine lands in M2" icon={AlertTriangle} />
	</section>

	<Card>
		{#snippet header()}
			<h2 class="text-base font-semibold leading-none tracking-tight">What is in this build?</h2>
			<p class="text-sm text-muted-foreground">
				M1 is the SvelteKit foundation. Real widgets, polling, and admin tooling land in
				M2.
			</p>
		{/snippet}

		<ul class="ml-5 list-disc space-y-1 text-sm text-card-foreground">
			<li>Design system primitives in <code class="rounded bg-muted px-1.5 py-0.5 text-xs">src/lib/components/ui/</code></li>
			<li>App shell with sidebar, topbar, mobile drawer, skip-to-content link</li>
			<li>Command palette (<kbd class="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">⌘K</kbd> / <kbd class="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">Ctrl+K</kbd>)</li>
			<li>Light / dark mode and four brand presets (cortex, teal, emerald, amber)</li>
			<li>i18n scaffold with <code class="rounded bg-muted px-1.5 py-0.5 text-xs">en</code>, <code class="rounded bg-muted px-1.5 py-0.5 text-xs">es</code>, <code class="rounded bg-muted px-1.5 py-0.5 text-xs">pt-br</code></li>
			<li>Stub <code class="rounded bg-muted px-1.5 py-0.5 text-xs">/login</code> form (real PAM in M3)</li>
		</ul>
	</Card>
</div>
