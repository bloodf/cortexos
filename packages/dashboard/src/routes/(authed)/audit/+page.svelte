<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ScrollText from '$lib/icons/ScrollText.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.audit'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description="Append-only audit log of every privileged action."
		icon={ScrollText}
	/>

	<EmptyState
		{title}
		description="The M1 SvelteKit foundation wires the route. Audit viewer lands in M2."
		icon={ScrollText}
	/>
</div>
