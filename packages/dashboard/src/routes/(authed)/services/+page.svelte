<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PlugZap from '$lib/icons/PlugZap.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.services'));
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

	<EmptyState
		{title}
		description="The M1 SvelteKit foundation wires the route. Real widgets land in M2."
		icon={PlugZap}
	/>
</div>
