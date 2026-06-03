<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		header?: Snippet;
		title?: Snippet;
		description?: Snippet;
		footer?: Snippet;
		children?: Snippet;
	}

	let { class: className = '', header, title, description, footer, children }: Props = $props();
</script>

<section
	class={cn(
		'glass-panel flex flex-col gap-3 rounded-lg p-5 text-card-foreground',
		className
	)}
>
	{#if header || title || description}
		<header class="flex flex-col gap-1">
			{#if header}
				{@render header()}
			{:else}
				{#if title}
					<h3 class="text-base font-semibold leading-none tracking-tight">
						{@render title()}
					</h3>
				{/if}
				{#if description}
					<p class="text-sm text-muted-foreground">
						{@render description()}
					</p>
				{/if}
			{/if}
		</header>
	{/if}

	<div class="flex-1">
		{#if children}
			{@render children()}
		{/if}
	</div>

	{#if footer}
		<footer class="border-t pt-3 text-sm text-muted-foreground">
			{@render footer()}
		</footer>
	{/if}
</section>
