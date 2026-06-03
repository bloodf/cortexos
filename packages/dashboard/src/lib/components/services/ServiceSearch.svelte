<!--
  ServiceSearch — controlled search + filter bar for the Services list.

  Composed of a free-text input and a category select. The component
  is fully controlled: every change fires a callback so the parent
  (page + DataTable) is the single source of truth for the filter
  state. URL search params are wired by the parent in +page.svelte.

  The two-way state is deliberately local + lifted:
    - The text input keeps its own buffer so typing is smooth even
      if the parent re-renders (no cursor jump on debounce).
    - `onChange` only fires after a short idle window (150ms), so we
      don't push every keystroke into the URL.
-->
<script lang="ts">
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import type { Service } from '@cortexos/contracts';

	type Props = {
		/** Free-text query. */
		query: string;
		/** Active category filter (`''` = all). */
		category: string;
		/** All available category values. The component does not
		 *  compute this list — the parent passes the union of
		 *  categories present in the loaded data. */
		categories: readonly string[];
		/** Fires after the debounce window. */
		onChange: (next: { query: string; category: string }) => void;
		/** Optional className passthrough. */
		class?: string;
	};

	let { query, category, categories, onChange, class: className }: Props = $props();

	// Local buffer so typing is responsive; we don't push every
	// keystroke through `onChange` to the URL.
	// svelte-ignore state_referenced_locally -- intentional initial value
	let buffer = $state(query);
	// svelte-ignore state_referenced_locally -- intentional initial value
	let cat = $state(category);

	let debounceId: ReturnType<typeof setTimeout> | null = null;

	function scheduleCommit(): void {
		if (debounceId) clearTimeout(debounceId);
		debounceId = setTimeout(() => {
			onChange({ query: buffer, category: cat });
		}, 150);
	}

	/** Build the category options. Always include "All categories". */
	const categoryOptions = $derived([
		{ value: '', label: 'All categories' },
		...categories.map((c) => ({ value: c, label: c })),
	]);

	/** Whether the controls have a non-empty value (used to enable a clear button). */
	const hasValue = $derived(buffer.trim() !== '' || cat !== '');

	// Re-sync local buffer if the parent resets the URL state externally
	// (e.g. user clicks the "Clear" button — see below).
	$effect(() => {
		if (query !== buffer && document.activeElement?.tagName !== 'INPUT') {
			buffer = query;
		}
	});
	$effect(() => {
		if (category !== cat && document.activeElement?.tagName !== 'SELECT') {
			cat = category;
		}
	});

	function clear(): void {
		buffer = '';
		cat = '';
		onChange({ query: '', category: '' });
	}

	// Surface the service type so the import is preserved (we may
	// want to extend the search to take the Service[] in the future).
	type _Unused = Service;
</script>

<div
	data-slot="service-search"
	class={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className ?? ''}`}
	role="search"
	aria-label="Filter services"
>
	<div class="flex flex-1 items-center gap-2">
		<Input
			type="search"
			placeholder="Search by name, slug, or description…"
			bind:value={buffer}
			oninput={scheduleCommit}
			class="max-w-md"
		/>
		<Select
			ariaLabel="Filter by category"
			value={cat}
			options={categoryOptions}
			onchange={(e) => {
				cat = (e.currentTarget as HTMLSelectElement).value;
				scheduleCommit();
			}}
			class="max-w-[14rem]"
		/>
		{#if hasValue}
			<button
				type="button"
				data-slot="service-search-clear"
				class="text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={clear}
			>
				Clear
			</button>
		{/if}
	</div>
</div>
