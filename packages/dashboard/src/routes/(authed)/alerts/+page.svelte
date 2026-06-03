<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.alerts'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description="Active and recently-resolved alerts across the host."
		icon={AlertTriangle}
	/>

	<EmptyState
		{title}
		description="The M1 SvelteKit foundation wires the route. Alert engine lands in M2."
		icon={AlertTriangle}
	/>
</div>
