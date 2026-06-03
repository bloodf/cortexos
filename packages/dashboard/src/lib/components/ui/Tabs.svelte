<script lang="ts" module>
	import { writable, type Writable } from 'svelte/store';
	import { SvelteMap } from 'svelte/reactivity';

	type TabsContext = {
		value: Writable<string>;
		baseId: string;
	};

	const REGISTRY = new SvelteMap<string, TabsContext>();

	export function registerTabs(id: string, value: Writable<string>): TabsContext {
		const ctx: TabsContext = { value, baseId: id };
		REGISTRY.set(id, ctx);
		return ctx;
	}

	export function unregisterTabs(id: string): void {
		REGISTRY.delete(id);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { onDestroy } from 'svelte';

	interface TabSpec {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		value: string;
		class?: string;
		tabs: readonly TabSpec[];
		ariaLabel?: string;
		children?: Snippet<[{ active: string }]>;
	}

	let { value = $bindable(''), class: className = '', tabs, ariaLabel, children }: Props = $props();

	const store = writable(value);
	const baseId = `tabs-${Math.random().toString(36).slice(2, 9)}`;
	registerTabs(baseId, store);
	onDestroy(() => unregisterTabs(baseId));

	$effect(() => {
		store.set(value);
	});
	$effect(() => {
		const next = $store;
		if (next !== value) value = next;
	});
</script>

<div class={cn('flex flex-col gap-3', className)}>
	<div
		role="tablist"
		aria-label={ariaLabel}
		class="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-muted/40 p-1"
	>
		{#each tabs as tab (tab.value)}
			{@const active = $store === tab.value}
			<button
				type="button"
				role="tab"
				id="{baseId}-{tab.value}"
				aria-selected={active}
				aria-controls="{baseId}-{tab.value}-panel"
				tabindex={active ? 0 : -1}
				disabled={tab.disabled}
				class={cn(
					'inline-flex h-7 items-center justify-center rounded px-3 text-sm font-medium transition-colors',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					active
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'
				)}
				onclick={() => {
					store.set(tab.value);
				}}
				onkeydown={(e) => {
					if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
					e.preventDefault();
					const idx = tabs.findIndex((t) => t.value === $store);
					const delta = e.key === 'ArrowRight' ? 1 : -1;
					const next = tabs[(idx + delta + tabs.length) % tabs.length];
					if (next) store.set(next.value);
				}}
			>
				{tab.label}
			</button>
		{/each}
	</div>
	{#if children}
		{@render children({ active: $store })}
	{/if}
</div>
