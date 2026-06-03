<script lang="ts">
	import type { LayoutData } from './$types';
	import Button from '$lib/components/ui/Button.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: LayoutData;
		error: Error & { status?: number };
	}

	let { data, error }: Props = $props();

	const status = $derived(error.status ?? 500);
	const title = $derived(
		status === 404 ? t(data.messages, 'errors.notFound') : t(data.messages, 'errors.serverError')
	);
</script>

<svelte:head>
	<title>{status} · {title}</title>
</svelte:head>

<div class="grid place-items-center py-16">
	<div class="glass-panel flex max-w-md flex-col items-center gap-3 rounded-lg p-6 text-center">
		<span class="text-3xl font-semibold tabular-nums">{status}</span>
		<p class="text-sm text-muted-foreground">{error.message}</p>
		<Button variant="outline" size="sm" onclick={() => (window.location.href = '/')}>
			{t(data.messages, 'app.nav.dashboard')}
		</Button>
	</div>
</div>
