<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { flattenNav, type NavItem } from '$lib/nav';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { t, type Messages } from '$lib/i18n';
	import Search from '$lib/icons/Search.svelte';
	import Command from '$lib/icons/Command.svelte';

	interface Props {
		messages: Messages;
	}

	let { messages }: Props = $props();

	let open = $state(false);
	let query = $state('');
	let activeIndex = $state(0);
	let inputEl: HTMLInputElement | null = $state(null);

	const items = $derived(flattenNav());
	const filtered = $derived.by((): NavItem[] => {
		const q = query.trim().toLowerCase();
		if (!q) return items.filter((i) => i.href !== null);
		return items.filter((item) => {
			const haystack = [
				item.label,
				item.id,
				...(item.keywords ?? []),
				item.shortcut ?? ''
			]
				.join(' ')
				.toLowerCase();
			return haystack.includes(q);
		});
	});

	$effect(() => {
		// Clamp the active index when the filter changes.
		if (activeIndex >= filtered.length) activeIndex = 0;
	});

	function show(): void {
		open = true;
		query = '';
		activeIndex = 0;
		void tick().then(() => inputEl?.focus());
	}

	function hide(): void {
		open = false;
	}

	function activate(item: NavItem): void {
		if (item.href) {
			void goto(item.href);
		}
		hide();
	}

	function onKey(e: KeyboardEvent): void {
		const isK = e.key === 'k' || e.key === 'K';
		if (isK && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			if (open) {
				hide();
			} else {
				show();
			}
			return;
		}
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			hide();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % Math.max(filtered.length, 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = (activeIndex - 1 + filtered.length) % Math.max(filtered.length, 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const item = filtered[activeIndex];
			if (item) activate(item);
		}
	}

	onMount(() => {
		const onShortcut = (e: KeyboardEvent) => onKey(e);
		window.addEventListener('keydown', onShortcut);
		return () => window.removeEventListener('keydown', onShortcut);
	});

	function labelOf(item: NavItem): string {
		return item.label.includes('.') ? t(messages, item.label) : item.label;
	}
</script>

<button
	type="button"
	aria-label={t(messages, 'app.shell.openCommandPalette')}
	class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
	onclick={show}
>
	<Command class="h-4 w-4" />
</button>

<Dialog
	bind:open
	title={t(messages, 'app.shell.openCommandPalette')}
	description="Jump to any page, service, or alert. Press ↑↓ to navigate, Enter to open, Esc to close."
	class="max-w-xl"
	onclose={hide}
>
	<div class="flex flex-col gap-3">
		<div
			class="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2"
		>
			<Search class="h-4 w-4 text-muted-foreground" />
			<input
				bind:this={inputEl}
				bind:value={query}
				type="search"
				aria-label="Search command palette"
				placeholder={t(messages, 'app.shell.search')}
				class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
				oninput={() => (activeIndex = 0)}
			/>
		</div>
		<ul role="listbox" class="max-h-72 overflow-auto py-1">
			{#each filtered as item, idx (item.id)}
				<li role="presentation">
					<button
						type="button"
						role="option"
						aria-selected={idx === activeIndex}
						tabindex={-1}
						class="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm transition-colors {idx ===
						activeIndex
							? 'bg-accent text-accent-foreground'
							: 'hover:bg-accent/60'}"
						onmouseenter={() => (activeIndex = idx)}
						onclick={() => activate(item)}
					>
						<span class="truncate">{labelOf(item)}</span>
						{#if item.workstream}
							<span
								class="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
								>{item.workstream}</span
							>
						{:else if item.shortcut}
							<kbd
								class="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
								>{item.shortcut}</kbd
							>
						{/if}
					</button>
				</li>
			{:else}
				<li class="px-2 py-4 text-center text-sm text-muted-foreground">No results.</li>
			{/each}
		</ul>
		<footer class="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
			<span>{filtered.length} results</span>
			<span class="flex items-center gap-2">
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">↑↓</kbd>
				navigate
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">↵</kbd>
				select
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">Esc</kbd>
				close
			</span>
		</footer>
	</div>
</Dialog>
