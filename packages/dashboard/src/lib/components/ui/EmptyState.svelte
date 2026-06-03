<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		title: string;
		description?: string;
		icon?: Component;
		action?: Snippet;
	}

	let { class: className = '', title, description, icon: IconComp, action }: Props = $props();
</script>

<div
	role="status"
	class={cn(
		'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/50 p-8 text-center',
		className
	)}
>
	{#if IconComp}
		<div class="rounded-full bg-muted p-3 text-muted-foreground">
			<IconComp class="h-5 w-5" />
		</div>
	{/if}
	<div class="space-y-1">
		<h3 class="text-sm font-semibold leading-none tracking-tight">{title}</h3>
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if action}
		<div class="pt-1">
			{@render action()}
		</div>
	{/if}
</div>
