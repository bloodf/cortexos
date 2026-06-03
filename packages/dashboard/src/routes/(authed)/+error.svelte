<script lang="ts">
	// `eslint-plugin-svelte`'s `valid-prop-names-in-kit-pages` rule
	// whitelists `data`, `errors`, `form`, `params`, `snapshot`, and
	// (in Svelte 5) `children` for SvelteKit page components. SvelteKit
	// itself documents that `+error.svelte` receives `error` and
	// `status` as built-in props — which the rule doesn't know about.
	// Disable it for this file only.
	/* eslint-disable svelte/valid-prop-names-in-kit-pages */
	import type { LayoutData } from './$types';
	import Button from '$lib/components/ui/Button.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: LayoutData;
		error: App.Error;
		status: number;
	}

	let { data, error, status }: Props = $props();

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
