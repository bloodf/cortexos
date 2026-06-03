<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import BookOpenCheck from '$lib/icons/BookOpenCheck.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.approvals'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description="Pending privileged-command approval tokens."
		icon={BookOpenCheck}
	/>

	<EmptyState
		{title}
		description="The M1 SvelteKit foundation wires the route. Approval flow lands in M2."
		icon={BookOpenCheck}
	/>
</div>
