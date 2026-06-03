<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Network from '$lib/icons/Network.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.network'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description="Interfaces, Tailscale peers, firewall rules, and listeners."
		icon={Network}
	/>

	<EmptyState
		{title}
		description="The M1 SvelteKit foundation wires the route. Real widgets land in M2."
		icon={Network}
	/>
</div>
