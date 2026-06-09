<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		label: string;
		value: string | Snippet;
		hint?: string;
		icon?: Component;
		trend?: Snippet;
		orientation?: 'vertical' | 'horizontal';
		class?: string;
	}

	let {
		label,
		value,
		hint,
		icon: IconComp,
		trend,
		orientation = 'vertical',
		class: className = '',
	}: Props = $props();
</script>

<div class={cn('glass-panel h-full w-full flex flex-col overflow-hidden', className)}>
	<div
		class={cn(
			'p-4 flex-1 min-h-0',
			orientation === 'horizontal' ? 'flex items-stretch gap-3' : 'flex flex-col gap-3',
		)}
	>
		<div
			class={cn(
				'flex items-start justify-between gap-2',
				orientation === 'horizontal' && 'flex-col flex-1 min-w-0',
			)}
		>
			<div class="space-y-1 min-w-0 flex-1">
				<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
					{label}
				</p>
				<p class="text-2xl font-semibold tabular-nums leading-tight truncate">
					{#if typeof value === 'string'}
						{value}
					{:else}
						{@render value()}
					{/if}
				</p>
				{#if hint}
					<p class="text-xs text-muted-foreground truncate">{hint}</p>
				{/if}
			</div>
			{#if IconComp && orientation !== 'horizontal'}
				<IconComp class="h-4 w-4 text-muted-foreground shrink-0" />
			{/if}
		</div>
		{#if trend}
			<div
				class={cn(
					'min-h-0 overflow-hidden',
					orientation === 'horizontal' ? 'flex-1 min-w-0 self-stretch' : 'mt-auto flex-1',
				)}
			>
				{@render trend()}
			</div>
		{/if}
	</div>
</div>
