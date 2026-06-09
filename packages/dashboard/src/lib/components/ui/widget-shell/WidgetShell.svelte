<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		title?: string;
		icon?: Component;
		actions?: Snippet;
		children: Snippet;
		scroll?: boolean;
		flush?: boolean;
		class?: string;
		bodyClassName?: string;
	}

	let {
		title,
		icon: IconComp,
		actions,
		children,
		scroll = false,
		flush = false,
		class: className = '',
		bodyClassName = '',
	}: Props = $props();
</script>

<div
	class={cn(
		'glass-panel h-full w-full flex flex-col rounded-xl border bg-card text-card-foreground shadow overflow-hidden',
		className,
	)}
>
	{#if title}
		<div class="flex items-center justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
			<div class="flex items-center gap-2 min-w-0">
				{#if IconComp}
					<IconComp class="h-4 w-4 text-muted-foreground shrink-0" />
				{/if}
				<h3 class="text-sm font-semibold leading-none truncate">{title}</h3>
			</div>
			{#if actions}
				<div class="shrink-0">
					{@render actions()}
				</div>
			{/if}
		</div>
	{/if}
	<div
		class={cn(
			'flex-1 min-h-0',
			flush ? 'p-0' : 'px-4 pb-4',
			!title && !flush && 'pt-4',
			scroll ? 'overflow-auto' : 'overflow-hidden',
			bodyClassName,
		)}
	>
		{@render children()}
	</div>
</div>
