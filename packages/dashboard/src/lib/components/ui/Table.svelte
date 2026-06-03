<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		caption?: string;
		children?: Snippet;
	}

	let { class: className = '', caption, children }: Props = $props();
</script>

<div class="w-full overflow-auto rounded-md border border-border">
	<table class={cn('w-full caption-bottom text-sm', className)}>
		{#if caption}
			<caption class="mt-2 text-sm text-muted-foreground">{caption}</caption>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</table>
</div>
