<script lang="ts">
	import { t, type Messages } from '$lib/i18n';
	import Button from '$lib/components/ui/Button.svelte';

	// /logout has no own page load (the loader just throws redirect);
	// we still receive `data` from the root layout, but the strict
	// type comes out as `never` because the page's own server data
	// is `never`. We accept `unknown` here and read messages via a
	// narrower cast at the call site. `$derived` keeps the cast
	// reactive when the layout data changes.
	let { data }: { data: unknown } = $props();
	const messages = $derived((data as { messages: Messages }).messages);
</script>

<svelte:head>
	<title>{t(messages, 'app.shell.signOut')} · CortexOS</title>
</svelte:head>

<form method="POST" class="flex flex-col items-center gap-3 text-center">
	<p class="text-sm text-muted-foreground">{t(messages, 'app.shell.signOut')}?</p>
	<Button type="submit" variant="default" size="md">
		{t(messages, 'app.shell.signOut')}
	</Button>
</form>
