<!--
  AuditFilters — controlled filter bar for the audit log.

  Composed of six inputs: actor, surface, action, result, since, until.
  The component is fully controlled: every change fires a callback so the
  parent (page) is the single source of truth for the filter state. URL
  search params are wired by the parent in +page.svelte (so the filtered
  view is shareable).

  The text inputs keep their own buffer so typing is smooth even if the
  parent re-renders (no cursor jump on debounce). `onChange` only fires
  after a short idle window (150ms), so we don't push every keystroke
  into the URL.

  i18n: every visible string (placeholder, label, clear button) routes
  through t(messages, 'audit.filters.*').
-->
<script lang="ts">
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { t, type Messages } from '$lib/i18n';
	import type { AuditResult } from './AuditResultBadge.svelte';

	export type AuditFiltersValue = {
		actor: string;
		surface: string;
		action: string;
		result: '' | AuditResult;
		since: string;
		until: string;
	};

	type Props = {
		/** Current filter values. */
		value: AuditFiltersValue;
		/** Surfaces available for the surface select. */
		surfaces: readonly string[];
		/** Actions available for the action select. */
		actions: readonly string[];
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Fires after the debounce window. */
		onChange: (next: AuditFiltersValue) => void;
		/** Optional className passthrough. */
		class?: string;
	};

	let { value, surfaces, actions, messages, onChange, class: className }: Props = $props();

	// Local buffers so typing is responsive.
	// svelte-ignore state_referenced_locally -- intentional initial value
	let actorBuf = $state(value.actor);
	// svelte-ignore state_referenced_locally -- intentional initial value
	let surfaceBuf = $state(value.surface);
	// svelte-ignore state_referenced_locally -- intentional initial value
	let actionBuf = $state(value.action);
	// svelte-ignore state_referenced_locally -- intentional initial value
	let resultBuf = $state<'' | AuditResult>(value.result);
	// svelte-ignore state_referenced_locally -- intentional initial value
	let sinceBuf = $state(value.since);
	// svelte-ignore state_referenced_locally -- intentional initial value
	let untilBuf = $state(value.until);

	let debounceId: ReturnType<typeof setTimeout> | null = null;

	function scheduleCommit(): void {
		if (debounceId) clearTimeout(debounceId);
		debounceId = setTimeout(() => {
			onChange({
				actor: actorBuf,
				surface: surfaceBuf,
				action: actionBuf,
				result: resultBuf,
				since: sinceBuf,
				until: untilBuf,
			});
		}, 150);
	}

	/** Result options: always include "all results" first. */
	const resultOptions = $derived([
		{ value: '', label: t(messages, 'audit.filters.allResults') },
		{ value: 'success', label: t(messages, 'audit.result.success') },
		{ value: 'failure', label: t(messages, 'audit.result.failure') },
		{ value: 'denied', label: t(messages, 'audit.result.denied') },
		{ value: 'error', label: t(messages, 'audit.result.error') },
	]);

	const surfaceOptions = $derived([
		{ value: '', label: t(messages, 'audit.filters.allSurfaces') },
		...surfaces.map((s) => ({ value: s, label: s })),
	]);

	const actionOptions = $derived([
		{ value: '', label: t(messages, 'audit.filters.allActions') },
		...actions.map((a) => ({ value: a, label: a })),
	]);

	/** Whether the controls have any non-empty value (enables the clear button). */
	const hasValue = $derived(
		actorBuf.trim() !== '' ||
			surfaceBuf !== '' ||
			actionBuf !== '' ||
			resultBuf !== '' ||
			sinceBuf !== '' ||
			untilBuf !== '',
	);

	// Re-sync local buffers if the parent resets the URL state externally
	// (e.g. user clicks the "Clear" button).
	$effect(() => {
		if (value.actor !== actorBuf && document.activeElement?.tagName !== 'INPUT') {
			actorBuf = value.actor;
		}
	});
	$effect(() => {
		if (value.surface !== surfaceBuf && document.activeElement?.tagName !== 'SELECT') {
			surfaceBuf = value.surface;
		}
	});
	$effect(() => {
		if (value.action !== actionBuf && document.activeElement?.tagName !== 'INPUT') {
			actionBuf = value.action;
		}
	});
	$effect(() => {
		if (value.result !== resultBuf && document.activeElement?.tagName !== 'SELECT') {
			resultBuf = value.result;
		}
	});
	$effect(() => {
		if (value.since !== sinceBuf && document.activeElement?.tagName !== 'INPUT') {
			sinceBuf = value.since;
		}
	});
	$effect(() => {
		if (value.until !== untilBuf && document.activeElement?.tagName !== 'INPUT') {
			untilBuf = value.until;
		}
	});

	function clear(): void {
		actorBuf = '';
		surfaceBuf = '';
		actionBuf = '';
		resultBuf = '';
		sinceBuf = '';
		untilBuf = '';
		onChange({ actor: '', surface: '', action: '', result: '', since: '', until: '' });
	}

	const ariaLabel = $derived(t(messages, 'audit.filters.label'));
	const actorPlaceholder = $derived(t(messages, 'audit.filters.actorPlaceholder'));
	const surfaceLabel = $derived(t(messages, 'audit.filters.surfaceLabel'));
	const actionPlaceholder = $derived(t(messages, 'audit.filters.actionPlaceholder'));
	const resultLabel = $derived(t(messages, 'audit.filters.resultLabel'));
	const sinceLabel = $derived(t(messages, 'audit.filters.sinceLabel'));
	const untilLabel = $derived(t(messages, 'audit.filters.untilLabel'));
	const clearLabel = $derived(t(messages, 'audit.filters.clear'));
</script>

<form
	data-slot="audit-filters"
	class={`flex flex-col gap-3 ${className ?? ''}`}
	role="search"
	aria-label={ariaLabel}
	onsubmit={(e) => e.preventDefault()}
>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span>{t(messages, 'audit.filters.actor')}</span>
			<Input
				type="search"
				placeholder={actorPlaceholder}
				bind:value={actorBuf}
				oninput={scheduleCommit}
			/>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span>{surfaceLabel}</span>
			<Select
				ariaLabel={surfaceLabel}
				value={surfaceBuf}
				options={surfaceOptions}
				onchange={(e) => {
					surfaceBuf = (e.currentTarget as HTMLSelectElement).value;
					scheduleCommit();
				}}
			/>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span>{t(messages, 'audit.filters.action')}</span>
			<Input
				type="search"
				placeholder={actionPlaceholder}
				bind:value={actionBuf}
				oninput={scheduleCommit}
			/>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span>{resultLabel}</span>
			<Select
				ariaLabel={resultLabel}
				value={resultBuf}
				options={resultOptions}
				onchange={(e) => {
					resultBuf = (e.currentTarget as HTMLSelectElement).value as '' | AuditResult;
					scheduleCommit();
				}}
			/>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span>{sinceLabel}</span>
			<Input
				type="text"
				placeholder="ISO 8601"
				bind:value={sinceBuf}
				oninput={scheduleCommit}
			/>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span>{untilLabel}</span>
			<Input
				type="text"
				placeholder="ISO 8601"
				bind:value={untilBuf}
				oninput={scheduleCommit}
			/>
		</label>
	</div>
	{#if hasValue}
		<div class="flex justify-end">
			<button
				type="button"
				data-slot="audit-filters-clear"
				class="text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={clear}
			>
				{clearLabel}
			</button>
		</div>
	{/if}
</form>
