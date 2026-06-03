<!--
  /audit/verify — full chain verification report.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import ChainVerifyReport from '$lib/components/audit/ChainVerifyReport.svelte';
	import ScrollText from '$lib/icons/ScrollText.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'audit.verify.title'));
	const description = $derived(t(data.messages, 'audit.verify.description'));
	const runAgainLabel = $derived(t(data.messages, 'audit.verify.runAgain'));

	let running = $state(false);

	async function runAgain(): Promise<void> {
		running = true;
		try {
			await invalidateAll();
		} finally {
			running = false;
		}
	}
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		{description}
		icon={ScrollText}
		breadcrumbs={[
			{ label: t(data.messages, 'app.nav.dashboard'), href: '/dashboard' },
			{ label: t(data.messages, 'app.nav.audit'), href: '/audit' },
			{ label: title },
		]}
	/>
	{#snippet headerActions()}
		<button
			type="button"
			data-slot="audit-verify-rerun"
			class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
			disabled={running}
			onclick={runAgain}
		>
			{running ? t(data.messages, 'audit.verify.running') : runAgainLabel}
		</button>
	{/snippet}

	<ChainVerifyReport result={data.result} messages={data.messages} length={data.length} />

	<p class="text-xs text-muted-foreground">last run: {data.ranAt}</p>
</div>
