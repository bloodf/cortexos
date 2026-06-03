<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import TerminalSquare from '$lib/icons/TerminalSquare.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.terminal'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description="Web-TTY to the host (privileged; requires approval token)."
		icon={TerminalSquare}
	/>

	<EmptyState
		{title}
		description="The M1 SvelteKit foundation wires the route. xterm.js + approval flow land in M2."
		icon={TerminalSquare}
	/>
</div>
