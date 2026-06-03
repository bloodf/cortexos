<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import AppShell from '$lib/components/shell/AppShell.svelte';

	interface Props {
		data: LayoutData;
		children: Snippet;
	}

	let { data, children }: Props = $props();

	const username = $derived(data.user?.username ?? null);
	const isAdmin = $derived(Boolean(data.user?.isAdmin));
</script>

<AppShell
	messages={data.messages}
	locale={data.locale}
	themeMode={data.theme.mode}
	themePreset={data.theme.preset}
	{username}
	{isAdmin}
>
	{@render children()}
</AppShell>
