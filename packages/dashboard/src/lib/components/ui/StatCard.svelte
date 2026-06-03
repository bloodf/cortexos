<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		label: string;
		value: string;
		hint?: string;
		trend?: 'up' | 'down' | 'flat' | null;
		icon?: Component;
		footer?: Snippet;
	}

	let { class: className = '', label, value, hint, trend = null, icon: IconComp, footer }: Props = $props();

	const trendColor = $derived(
		trend === 'up'
			? 'text-success'
			: trend === 'down'
				? 'text-destructive'
				: 'text-muted-foreground'
	);
</script>

<div
	class={cn(
		'glass-panel flex flex-col gap-2 rounded-lg p-4 text-card-foreground',
		className
	)}
>
	<div class="flex items-center justify-between gap-2">
		<span class="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
		{#if IconComp}
			<IconComp class="h-4 w-4 text-muted-foreground" />
		{/if}
	</div>
	<div class="flex items-baseline gap-2">
		<span class="text-2xl font-semibold leading-none tabular-nums">{value}</span>
		{#if hint}
			<span class={cn('text-xs', trendColor)}>{hint}</span>
		{/if}
	</div>
	{#if footer}
		<div class="pt-1 text-xs text-muted-foreground">
			{@render footer()}
		</div>
	{/if}
</div>
