<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		for_?: string;
		class?: string;
		required?: boolean;
		children?: Snippet;
	}

	let { for_: forId, class: className = '', required = false, children }: Props = $props();
</script>

<label
	for={forId}
	class={cn(
		'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
		className
	)}
>
	{#if children}
		{@render children()}
	{/if}
	{#if required}
		<span aria-hidden="true" class="ml-0.5 text-destructive">*</span>
	{/if}
</label>
