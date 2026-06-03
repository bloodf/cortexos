<script lang="ts" module>
	import { writable, type Writable } from 'svelte/store';

	type DropdownContext = {
		open: Writable<boolean>;
		trigger: Writable<HTMLElement | null>;
	};

	const REGISTRY = new Map<string, DropdownContext>();

	export function registerDropdown(id: string, open: Writable<boolean>): DropdownContext {
		const ctx: DropdownContext = { open, trigger: writable(null) };
		REGISTRY.set(id, ctx);
		return ctx;
	}

	export function unregisterDropdown(id: string): void {
		REGISTRY.delete(id);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { onDestroy } from 'svelte';

	interface Props {
		open: boolean;
		class?: string;
		align?: 'start' | 'end' | 'center';
		trigger: Snippet<[{ open: () => void }]>;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		class: className = '',
		align = 'start',
		trigger,
		children
	}: Props = $props();

	const store = writable(open);
	const id = `dd-${Math.random().toString(36).slice(2, 9)}`;
	const ctx = registerDropdown(id, store);
	onDestroy(() => unregisterDropdown(id));

	$effect(() => store.set(open));
	$effect(() => {
		if ($store !== open) open = $store;
	});

	const alignClass = $derived(
		align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
	);

	function openDropdown(): void {
		store.set(true);
	}

	function close(): void {
		store.set(false);
	}

	function onwindowclick(e: MouseEvent): void {
		if (!$store) return;
		const target = e.target as HTMLElement | null;
		if (!target) return;
		const root = document.getElementById(`${id}-root`);
		if (root && !root.contains(target)) close();
	}
</script>

<svelte:window onclick={onwindowclick} />

<div id="{id}-root" class="relative inline-block">
	{@render trigger({ open: openDropdown })}
	{#if $store}
		<div
			role="menu"
			tabindex={-1}
			class={cn(
				'absolute z-40 mt-2 min-w-[10rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
				alignClass,
				className
			)}
		>
			{#if children}
				{@render children()}
			{/if}
		</div>
	{/if}
</div>
