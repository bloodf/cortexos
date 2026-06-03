<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		class?: string;
		children?: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		description,
		class: className = '',
		children,
		footer,
		onclose
	}: Props = $props();

	function close(): void {
		open = false;
		onclose?.();
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
		transition:fade={{ duration: 120 }}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex={-1}
			class={cn(
				'glass-panel w-full max-w-md rounded-lg p-5 outline-none text-card-foreground',
				className
			)}
			transition:scale={{ duration: 140, start: 0.96 }}
		>
			<header class="mb-3 flex flex-col gap-1">
				<h2 class="text-base font-semibold leading-none tracking-tight">{title}</h2>
				{#if description}
					<p class="text-sm text-muted-foreground">{description}</p>
				{/if}
			</header>
			<div class="text-sm">
				{#if children}
					{@render children()}
				{/if}
			</div>
			{#if footer}
				<footer class="mt-4 flex items-center justify-end gap-2 border-t pt-3">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}
